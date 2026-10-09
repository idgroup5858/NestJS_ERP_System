import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { OFFSET_METHOD } from 'src/payment/payment-methods';

export const GRANULARITIES = ['day', 'week', 'month', 'year'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BUCKETS = 800;
const HISTORY_TYPES = ['sale', 'return', 'purchase', 'expense'] as const;

/*
 * Barcha vaqt hisoblari biznes vaqt mintaqasida ($1). Ustunlar `timestamp without time zone`
 * bo'lib, bazaning sessiya mintaqasida yozilgan (now()) — avval shu mintaqa deb o'qiladi,
 * keyin biznes mintaqasiga o'giriladi. Shunda server UTC da bo'lsa ham "kun" Toshkent kuni bo'ladi.
 */
const local = (col: string, tz = '$1') =>
  `((${col}) AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE ${tz}`;
/** Chegaralar — "YYYY-MM-DD", ikkalasi ham kiradi. Postgres ishlatilmagan parametrni qabul qilmaydi, shuning uchun o'rinlari beriladi. */
const inRange = (col: string, tz = '$1', from = '$2', to = '$3') =>
  `${local(col, tz)} >= ${from}::date AND ${local(col, tz)} < (${to}::date + 1)`;
/** Xarajat oyga yoziladi: davr ichiga tushgan har bir oyning xarajati to'liq olinadi. */
const expenseInRange = (from = '$2', to = '$3') =>
  `e.period >= date_trunc('month', ${from}::date::timestamp)::date AND e.period <= ${to}::date`;

const num = (value: unknown) => (value === null || value === undefined ? 0 : Number(value));
const money = (value: unknown) => Math.round(num(value));
const qty = (value: unknown) => Math.round(num(value) * 1000) / 1000;

const person = (first?: string | null, last?: string | null) =>
  `${first ?? ''} ${last ?? ''}`.trim() || null;

/** Sana qo'shish/ayirish faqat kalendar kunlari bilan (vaqt mintaqasiz). */
function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function assertDate(value: string | undefined, name: string): string {
  if (!value || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new BadRequestException(`Параметр ${name} должен быть датой ГГГГ-ММ-ДД`);
  }
  // 2026-02-31 kabi sanalar Date.parse da "surilib" ketadi — qaytib solishtiramiz.
  if (new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`Несуществующая дата: ${value}`);
  }
  return value;
}

@Injectable()
export class StatsService implements OnModuleInit {

  private timezone = 'Asia/Tashkent';
  private readonly logger = new Logger(StatsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) { }

  async onModuleInit() {
    const wanted = this.config.get<string>('APP_TIMEZONE')?.trim();
    if (!wanted) return;
    const [row] = await this.dataSource.query('SELECT 1 AS ok FROM pg_timezone_names WHERE name = $1', [wanted]);
    if (row) this.timezone = wanted;
    else this.logger.warn(`APP_TIMEZONE "${wanted}" не найдена в PostgreSQL — используется ${this.timezone}`);
  }

  private parseRange(from?: string, to?: string) {
    const start = assertDate(from, 'from');
    const end = assertDate(to, 'to');
    if (start > end) throw new BadRequestException('Дата начала позже даты окончания');
    return { from: start, to: end, days: daysBetween(start, end) + 1 };
  }

  // ------------------------------------------------------------------ joriy davrlar

  /**
   * Bugun / hafta / oy / yil — davr boshidan hozirgacha, oldingi davrning xuddi shu
   * qismi bilan solishtirib (masalan, dushanba-chorshanba ↔ o'tgan dushanba-chorshanba).
   */
  async kpis() {
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `
      WITH now_l AS (SELECT (now() AT TIME ZONE $1) AS n),
      periods AS (
        SELECT v.key, v.start, v.prev_start, now_l.n,
               least(v.prev_start + (now_l.n - v.start), v.start) AS prev_end
        FROM now_l, LATERAL (VALUES
          ('day',   date_trunc('day',   now_l.n), date_trunc('day',   now_l.n) - interval '1 day'),
          ('week',  date_trunc('week',  now_l.n), date_trunc('week',  now_l.n) - interval '1 week'),
          ('month', date_trunc('month', now_l.n), date_trunc('month', now_l.n) - interval '1 month'),
          ('year',  date_trunc('year',  now_l.n), date_trunc('year',  now_l.n) - interval '1 year')
        ) AS v(key, start, prev_start)
      ),
      s AS (SELECT ${local('date')} AS t, (total - discount) AS net FROM sale),
      r AS (SELECT ${local('date')} AS t, (total - discount) AS net FROM "return")
      SELECT p.key,
        to_char(p.start, 'YYYY-MM-DD') AS start,
        to_char(p.n, 'YYYY-MM-DD') AS today,
        (SELECT coalesce(sum(net), 0) FROM s WHERE t >= p.start AND t <= p.n) AS sales,
        (SELECT count(*) FROM s WHERE t >= p.start AND t <= p.n) AS sales_count,
        (SELECT coalesce(sum(net), 0) FROM r WHERE t >= p.start AND t <= p.n) AS returns,
        (SELECT coalesce(sum(net), 0) FROM s WHERE t >= p.prev_start AND t < p.prev_end) AS prev_sales,
        (SELECT count(*) FROM s WHERE t >= p.prev_start AND t < p.prev_end) AS prev_sales_count,
        (SELECT coalesce(sum(net), 0) FROM r WHERE t >= p.prev_start AND t < p.prev_end) AS prev_returns
      FROM periods p
      `,
      [this.timezone],
    );

    const periods = Object.fromEntries(rows.map((row) => [
      row.key as string,
      {
        start: row.start as string,
        revenue: money(row.sales) - money(row.returns),
        salesCount: num(row.sales_count),
        previous: {
          revenue: money(row.prev_sales) - money(row.prev_returns),
          salesCount: num(row.prev_sales_count),
        },
      },
    ]));

    return { timezone: this.timezone, today: rows[0]?.today as string, periods };
  }

  // ------------------------------------------------------------------ davr hisoboti

  private async summary(from: string, to: string) {
    const [row]: Record<string, unknown>[] = await this.dataSource.query(
      `
      SELECT
        (SELECT count(*) FROM sale s WHERE ${inRange('s.date')}) AS sales_count,
        (SELECT coalesce(sum(s.total), 0) FROM sale s WHERE ${inRange('s.date')}) AS gross,
        (SELECT coalesce(sum(s.discount), 0) FROM sale s WHERE ${inRange('s.date')}) AS discount,
        (SELECT count(DISTINCT s."customerId") FROM sale s WHERE ${inRange('s.date')}) AS customers,
        (SELECT coalesce(sum(si.quantity), 0) FROM sale_item si JOIN sale s ON s.id = si."saleId"
          WHERE ${inRange('s.date')}) AS items_sold,
        (SELECT coalesce(sum(si.quantity * coalesce(p.price, 0)), 0) FROM sale_item si
          JOIN sale s ON s.id = si."saleId" LEFT JOIN product p ON p.id = si."productId"
          WHERE ${inRange('s.date')}) AS cogs,
        (SELECT count(*) FROM "return" r WHERE ${inRange('r.date')}) AS returns_count,
        (SELECT coalesce(sum(r.total - r.discount), 0) FROM "return" r WHERE ${inRange('r.date')}) AS returns,
        (SELECT coalesce(sum(ri.quantity * coalesce(p.price, 0)), 0) FROM return_item ri
          JOIN "return" r ON r.id = ri."returnsId" LEFT JOIN product p ON p.id = ri."productId"
          WHERE ${inRange('r.date')}) AS returns_cogs,
        (SELECT coalesce(sum(pm.amount), 0) FROM payment pm
          WHERE pm."saleId" IS NOT NULL AND pm.method <> $4 AND ${inRange('pm.date')}) AS cash_in,
        (SELECT coalesce(sum(pm.amount), 0) FROM payment pm
          WHERE pm."returnsId" IS NOT NULL AND pm.method <> $4 AND ${inRange('pm.date')}) AS refunds,
        (SELECT coalesce(sum(pm.amount), 0) FROM payment pm
          WHERE pm."purchaseId" IS NOT NULL AND ${inRange('pm.date')}) AS supplier_paid,
        (SELECT count(*) FROM purchase pu WHERE ${inRange('pu.date')}) AS purchases_count,
        (SELECT coalesce(sum(pu.total - pu.discount), 0) FROM purchase pu WHERE ${inRange('pu.date')}) AS purchases,
        (SELECT coalesce(sum(e.amount), 0) FROM expense e WHERE ${expenseInRange()}) AS expenses,
        (SELECT count(*) FROM expense e WHERE ${expenseInRange()}) AS expenses_count
      `,
      [this.timezone, from, to, OFFSET_METHOD],
    );

    const gross = money(row.gross);
    const discount = money(row.discount);
    const salesNet = gross - discount;
    const returns = money(row.returns);
    const salesCount = num(row.sales_count);
    const cogs = money(row.cogs) - money(row.returns_cogs);
    const grossProfit = salesNet - returns - cogs;
    const expenses = money(row.expenses);

    return {
      salesCount,
      customers: num(row.customers),
      itemsSold: qty(row.items_sold),
      gross,
      discount,
      salesNet,
      returnsCount: num(row.returns_count),
      returns,
      revenue: salesNet - returns,
      averageCheck: salesCount ? Math.round(salesNet / salesCount) : 0,
      cashIn: money(row.cash_in),
      refunds: money(row.refunds),
      purchasesCount: num(row.purchases_count),
      purchases: money(row.purchases),
      supplierPaid: money(row.supplier_paid),
      expensesCount: num(row.expenses_count),
      expenses,
      cogs,
      grossProfit,
      netProfit: grossProfit - expenses,
    };
  }

  /** Hozirgi umumiy qarz (barcha vaqt). To'lovlarga qaytarish hisobidan yopilgan qism ham kiradi. */
  private async debt() {
    const [row]: Record<string, unknown>[] = await this.dataSource.query(`
      SELECT coalesce(sum(greatest(0, s.total - s.discount - coalesce(p.paid, 0))), 0) AS debt,
             count(*) FILTER (WHERE s.total - s.discount - coalesce(p.paid, 0) > 0) AS debt_sales
      FROM sale s
      LEFT JOIN (SELECT "saleId", sum(amount) AS paid FROM payment WHERE "saleId" IS NOT NULL GROUP BY "saleId") p
        ON p."saleId" = s.id
    `);
    return { amount: money(row.debt), sales: num(row.debt_sales) };
  }

  private async series(from: string, to: string, granularity: Granularity) {
    const step = `1 ${granularity}`;
    const withExpenses = granularity === 'month' || granularity === 'year';
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `
      WITH buckets AS (
        SELECT generate_series(date_trunc($4, $2::date::timestamp), date_trunc($4, $3::date::timestamp), $5::interval) AS b
      ),
      s AS (
        SELECT date_trunc($4, ${local('s.date')}) AS b, count(*) AS cnt, sum(s.total - s.discount) AS net
        FROM sale s WHERE ${inRange('s.date')} GROUP BY 1
      ),
      c AS (
        SELECT date_trunc($4, ${local('s.date')}) AS b, sum(si.quantity * coalesce(p.price, 0)) AS cogs
        FROM sale_item si JOIN sale s ON s.id = si."saleId" LEFT JOIN product p ON p.id = si."productId"
        WHERE ${inRange('s.date')} GROUP BY 1
      ),
      r AS (
        SELECT date_trunc($4, ${local('r.date')}) AS b, sum(r.total - r.discount) AS net
        FROM "return" r WHERE ${inRange('r.date')} GROUP BY 1
      ),
      rc AS (
        SELECT date_trunc($4, ${local('r.date')}) AS b, sum(ri.quantity * coalesce(p.price, 0)) AS cogs
        FROM return_item ri JOIN "return" r ON r.id = ri."returnsId" LEFT JOIN product p ON p.id = ri."productId"
        WHERE ${inRange('r.date')} GROUP BY 1
      ),
      pm AS (
        SELECT date_trunc($4, ${local('pm.date')}) AS b,
               sum(pm.amount) FILTER (WHERE pm."saleId" IS NOT NULL AND pm.method <> $6) AS cash_in
        FROM payment pm WHERE ${inRange('pm.date')} GROUP BY 1
      ),
      pu AS (
        SELECT date_trunc($4, ${local('pu.date')}) AS b, sum(pu.total - pu.discount) AS amount
        FROM purchase pu WHERE ${inRange('pu.date')} GROUP BY 1
      ),
      e AS (
        SELECT date_trunc($4, e.period::timestamp) AS b, sum(e.amount) AS amount
        FROM expense e WHERE ${expenseInRange()} GROUP BY 1
      )
      SELECT to_char(buckets.b, 'YYYY-MM-DD') AS bucket,
        coalesce(s.cnt, 0) AS sales_count, coalesce(s.net, 0) AS sales_net,
        coalesce(c.cogs, 0) AS cogs, coalesce(r.net, 0) AS returns, coalesce(rc.cogs, 0) AS returns_cogs,
        coalesce(pm.cash_in, 0) AS cash_in, coalesce(pu.amount, 0) AS purchases, coalesce(e.amount, 0) AS expenses
      FROM buckets
      LEFT JOIN s ON s.b = buckets.b LEFT JOIN c ON c.b = buckets.b
      LEFT JOIN r ON r.b = buckets.b LEFT JOIN rc ON rc.b = buckets.b
      LEFT JOIN pm ON pm.b = buckets.b LEFT JOIN pu ON pu.b = buckets.b
      LEFT JOIN e ON e.b = buckets.b
      ORDER BY buckets.b
      `,
      [this.timezone, from, to, granularity, step, OFFSET_METHOD],
    );

    return rows.map((row) => {
      const revenue = money(row.sales_net) - money(row.returns);
      const grossProfit = revenue - (money(row.cogs) - money(row.returns_cogs));
      // Kun/hafta bo'yicha xarajat ko'rsatilmaydi: u butun oyga yoziladi va bitta kunga tushib qolardi.
      const expenses = withExpenses ? money(row.expenses) : null;
      return {
        bucket: row.bucket as string,
        salesCount: num(row.sales_count),
        revenue,
        cashIn: money(row.cash_in),
        purchases: money(row.purchases),
        grossProfit,
        expenses,
        netProfit: expenses === null ? null : grossProfit - expenses,
      };
    });
  }

  private async breakdowns(from: string, to: string) {
    const params = [this.timezone, from, to];
    // Chegirma qatorlarga mutanosib taqsimlanadi — mahsulot tushumi umumiy tushum bilan mos keladi.
    const lineRevenue = `si.quantity * si.price * (s.total - s.discount)::numeric / nullif(s.total, 0)`;

    const [products, categories, customers, cashiers, methods, expenses, debtors] = await Promise.all([
      this.dataSource.query(`
        SELECT p.id, coalesce(p.name, 'Удалённый товар') AS name, coalesce(p.unit, '') AS unit,
               sum(si.quantity) AS qty, coalesce(sum(${lineRevenue}), 0) AS revenue,
               sum(si.quantity * coalesce(p.price, 0)) AS cogs
        FROM sale_item si JOIN sale s ON s.id = si."saleId" LEFT JOIN product p ON p.id = si."productId"
        WHERE ${inRange('s.date')}
        GROUP BY p.id, p.name, p.unit ORDER BY revenue DESC LIMIT 10`, params),
      this.dataSource.query(`
        SELECT c.id, coalesce(c.name, 'Без категории') AS name,
               sum(si.quantity) AS qty, coalesce(sum(${lineRevenue}), 0) AS revenue
        FROM sale_item si JOIN sale s ON s.id = si."saleId"
        LEFT JOIN product p ON p.id = si."productId" LEFT JOIN category c ON c.id = p."categoryId"
        WHERE ${inRange('s.date')}
        GROUP BY c.id, c.name ORDER BY revenue DESC LIMIT 12`, params),
      this.dataSource.query(`
        SELECT c.id, c.username, c.surname, c.phone, count(*) AS cnt, sum(s.total - s.discount) AS revenue
        FROM sale s JOIN customer c ON c.id = s."customerId"
        WHERE ${inRange('s.date')}
        GROUP BY c.id ORDER BY revenue DESC LIMIT 10`, params),
      this.dataSource.query(`
        SELECT u.id, u.username, u.surname, count(*) AS cnt, sum(s.total - s.discount) AS revenue
        FROM sale s JOIN "user" u ON u.id = s."userId"
        WHERE ${inRange('s.date')}
        GROUP BY u.id ORDER BY revenue DESC LIMIT 10`, params),
      this.dataSource.query(`
        SELECT pm.method, count(*) AS cnt, sum(pm.amount) AS amount
        FROM payment pm
        WHERE pm."saleId" IS NOT NULL AND pm.amount > 0 AND pm.method <> $4 AND ${inRange('pm.date')}
        GROUP BY pm.method ORDER BY amount DESC`, [...params, OFFSET_METHOD]),
      this.dataSource.query(`
        SELECT e.category, count(*) AS cnt, sum(e.amount) AS amount
        FROM expense e WHERE ${expenseInRange('$1', '$2')}
        GROUP BY e.category ORDER BY amount DESC`, [from, to]),
      this.dataSource.query(`
        SELECT c.id, c.username, c.surname, c.phone,
               sum(greatest(0, s.total - s.discount - coalesce(p.paid, 0))) AS debt
        FROM sale s JOIN customer c ON c.id = s."customerId"
        LEFT JOIN (SELECT "saleId", sum(amount) AS paid FROM payment WHERE "saleId" IS NOT NULL GROUP BY "saleId") p
          ON p."saleId" = s.id
        GROUP BY c.id
        HAVING sum(greatest(0, s.total - s.discount - coalesce(p.paid, 0))) > 0
        ORDER BY debt DESC LIMIT 10`),
    ]);

    return {
      topProducts: products.map((r: Record<string, unknown>) => ({
        id: r.id as number | null,
        name: r.name as string,
        unit: r.unit as string,
        quantity: qty(r.qty),
        revenue: money(r.revenue),
        profit: money(r.revenue) - money(r.cogs),
      })),
      categories: categories.map((r: Record<string, unknown>) => ({
        id: r.id as number | null, name: r.name as string, quantity: qty(r.qty), revenue: money(r.revenue),
      })),
      topCustomers: customers.map((r: Record<string, unknown>) => ({
        id: r.id as number, name: person(r.username as string, r.surname as string), phone: r.phone as string,
        salesCount: num(r.cnt), revenue: money(r.revenue),
      })),
      cashiers: cashiers.map((r: Record<string, unknown>) => ({
        id: r.id as number, name: person(r.username as string, r.surname as string),
        salesCount: num(r.cnt), revenue: money(r.revenue),
      })),
      paymentMethods: methods.map((r: Record<string, unknown>) => ({
        method: r.method as string, count: num(r.cnt), amount: money(r.amount),
      })),
      expensesByCategory: expenses.map((r: Record<string, unknown>) => ({
        category: r.category as string, count: num(r.cnt), amount: money(r.amount),
      })),
      debtors: debtors.map((r: Record<string, unknown>) => ({
        id: r.id as number, name: person(r.username as string, r.surname as string), phone: r.phone as string,
        debt: money(r.debt),
      })),
    };
  }

  /** Tanlangan davr: jami, oldingi teng davr bilan solishtirish, dinamika va kesimlar. */
  async dashboard(fromRaw?: string, toRaw?: string, granularityRaw?: string) {
    const { from, to, days } = this.parseRange(fromRaw, toRaw);
    const granularity = (granularityRaw ?? 'day') as Granularity;
    if (!GRANULARITIES.includes(granularity)) {
      throw new BadRequestException('granularity: day | week | month | year');
    }
    const perBucket = { day: 1, week: 7, month: 28, year: 365 }[granularity];
    if (days / perBucket > MAX_BUCKETS) {
      throw new BadRequestException('Слишком много точек — выберите более крупный шаг');
    }

    const previousRange = { from: shiftDate(from, -days), to: shiftDate(from, -1) };

    const [current, previous, series, breakdowns, debt] = await Promise.all([
      this.summary(from, to),
      this.summary(previousRange.from, previousRange.to),
      this.series(from, to, granularity),
      this.breakdowns(from, to),
      this.debt(),
    ]);

    return {
      timezone: this.timezone,
      range: { from, to, days, granularity },
      previousRange,
      summary: current,
      previous,
      debt,
      series,
      ...breakdowns,
    };
  }

  // ------------------------------------------------------------------ yillik kalendar

  /**
   * Bir yil (1-yanvar — 31-dekabr) bo'yicha kunlik faollik: savdolar soni va tushum
   * (qaytarishlar ayirilgan). Faqat savdo yoki qaytarish bo'lgan kunlar qaytariladi.
   * `firstYear` — birinchi savdo yili (oldingi yilga o'tish tugmasini cheklash uchun).
   */
  async calendar(yearRaw?: string) {
    const [{ today, first_year }]: { today: string; first_year: number | null }[] = await this.dataSource.query(
      `SELECT to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD') AS today,
              (SELECT extract(year FROM min(${local('s.date')}))::int FROM sale s) AS first_year`,
      [this.timezone],
    );
    const currentYear = Number(today.slice(0, 4));
    const year = yearRaw === undefined || yearRaw === '' ? currentYear : Number(yearRaw);
    if (!Number.isInteger(year) || year < 2000 || year > currentYear + 1) {
      throw new BadRequestException('Параметр year должен быть годом');
    }

    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `
      WITH s AS (
        SELECT (${local('s.date')})::date AS d, count(*) AS cnt, sum(s.total - s.discount) AS net
        FROM sale s
        WHERE ${local('s.date')} >= make_date($2, 1, 1) AND ${local('s.date')} < make_date($2 + 1, 1, 1)
        GROUP BY 1
      ),
      r AS (
        SELECT (${local('r.date')})::date AS d, sum(r.total - r.discount) AS net
        FROM "return" r
        WHERE ${local('r.date')} >= make_date($2, 1, 1) AND ${local('r.date')} < make_date($2 + 1, 1, 1)
        GROUP BY 1
      )
      SELECT to_char(coalesce(s.d, r.d), 'YYYY-MM-DD') AS day,
             coalesce(s.cnt, 0) AS cnt, coalesce(s.net, 0) - coalesce(r.net, 0) AS revenue
      FROM s FULL JOIN r ON r.d = s.d
      ORDER BY 1
      `,
      [this.timezone, year],
    );

    const days = rows.map((row) => ({
      date: row.day as string,
      salesCount: num(row.cnt),
      revenue: money(row.revenue),
    }));

    return {
      year,
      today,
      firstYear: first_year ?? currentYear,
      lastYear: currentYear,
      days,
      totals: {
        salesCount: days.reduce((sum, d) => sum + d.salesCount, 0),
        revenue: days.reduce((sum, d) => sum + d.revenue, 0),
        activeDays: days.filter((d) => d.salesCount > 0).length,
      },
    };
  }

  // ------------------------------------------------------------------ tarix

  async history(page: number, limit: number, type?: string, from?: string, to?: string) {
    page = page > 0 ? page : 1;
    limit = limit > 0 ? Math.min(limit, 100) : 20;
    if (type && !(HISTORY_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException('type: sale | return | purchase | expense');
    }
    const range = from || to ? this.parseRange(from, to) : null;

    const events = `
      SELECT 'sale' AS type, s.id, s.date, (s.total - s.discount) AS amount,
             concat_ws(' ', c.username, c.surname) AS counterparty, concat_ws(' ', u.username, u.surname) AS who,
             NULL::text AS note
      FROM sale s LEFT JOIN customer c ON c.id = s."customerId" LEFT JOIN "user" u ON u.id = s."userId"
      UNION ALL
      SELECT 'return', r.id, r.date, (r.total - r.discount),
             concat_ws(' ', c.username, c.surname), concat_ws(' ', u.username, u.surname),
             CASE WHEN r."saleId" IS NOT NULL THEN 'Из продажи #' || r."saleId" END
      FROM "return" r LEFT JOIN customer c ON c.id = r."customerId" LEFT JOIN "user" u ON u.id = r."userId"
      UNION ALL
      SELECT 'purchase', pu.id, pu.date, (pu.total - pu.discount),
             concat_ws(' ', c.username, c.surname), concat_ws(' ', u.username, u.surname), NULL
      FROM purchase pu LEFT JOIN customer c ON c.id = pu."customerId" LEFT JOIN "user" u ON u.id = pu."userId"
      UNION ALL
      SELECT 'expense', e.id, e."createdAt", e.amount, e.category, concat_ws(' ', u.username, u.surname),
             concat_ws(' · ', 'за ' || to_char(e.period::timestamp, 'MM.YYYY'), nullif(e.comment, ''))
      FROM expense e LEFT JOIN "user" u ON u.id = e."userId"
    `;

    const conditions: string[] = ['($1::text IS NULL OR h.type = $1)'];
    const params: unknown[] = [type ?? null];
    if (range) {
      params.push(this.timezone, range.from, range.to);
      conditions.push(inRange('h.date', '$2', '$3', '$4'));
    }
    const where = conditions.join(' AND ');

    const [rows, [{ total }]] = await Promise.all([
      this.dataSource.query(
        `SELECT h.* FROM (${events}) h WHERE ${where} ORDER BY h.date DESC, h.id DESC
         LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params,
      ),
      this.dataSource.query(`SELECT count(*)::int AS total FROM (${events}) h WHERE ${where}`, params),
    ]);

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: rows.map((r: Record<string, unknown>) => ({
        type: r.type as string,
        id: r.id as number,
        date: r.date as Date,
        amount: money(r.amount),
        counterparty: (r.counterparty as string) || null,
        who: (r.who as string) || null,
        note: (r.note as string) || null,
      })),
    };
  }
}
