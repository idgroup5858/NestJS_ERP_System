import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OFFSET_METHOD } from 'src/payment/payment-methods';
import { Customer } from './entities/customer.entity';
import { OPERATIONS_MAX_LIMIT, OperationType } from './dto/customer-operations-query.dto';

type Row = Record<string, unknown>;

const num = (value: unknown) => (value === null || value === undefined ? 0 : Number(value));
const money = (value: unknown) => Math.round(num(value));
const qty = (value: unknown) => Math.round(num(value) * 1000) / 1000;

/** Operatsiya jadvallari: har birida jami, chegirma, to'lovlar (`payment`) va qatorlar (`*_item`) bor. */
const SOURCES = {
  sale: { table: 'sale', itemTable: 'sale_item', itemKey: '"saleId"', paymentKey: '"saleId"' },
  return: { table: '"return"', itemTable: 'return_item', itemKey: '"returnsId"', paymentKey: '"returnsId"' },
  purchase: { table: 'purchase', itemTable: 'purchase_item', itemKey: '"purchaseId"', paymentKey: '"purchaseId"' },
} as const;

/**
 * Kontragent kartochkasi: ma'lumotlari, savdo/qaytarish/xarid bo'yicha jamlanma va operatsiyalar tarixi.
 *
 * Hisob qoidalari statistika bilan bir xil: summa = jami − chegirma; savdo qarzi = max(0, summa − to'lovlar),
 * to'lovlar ichida «Зачёт возврата» ham bor (u qarzni yopadi, lekin pul kelishi emas).
 */
@Injectable()
export class CustomerProfileService {

  constructor(
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    private readonly dataSource: DataSource,
  ) { }

  private async requireCustomer(id: number) {
    const customer = await this.customers.findOneBy({ id });
    if (!customer) throw new NotFoundException('Контрагент не найден');
    return customer;
  }

  async profile(id: number) {
    const customer = await this.requireCustomer(id);

    const [sales, returns, purchases, methods, products, months] = await Promise.all([
      this.dataSource.query(`
        SELECT count(*) AS cnt,
               coalesce(sum(s.total), 0) AS gross,
               coalesce(sum(s.discount), 0) AS discount,
               coalesce(sum(s.total - s.discount), 0) AS net,
               coalesce(sum(coalesce(p.paid, 0)), 0) AS paid,
               coalesce(sum(coalesce(p.cash, 0)), 0) AS cash,
               coalesce(sum(greatest(0, s.total - s.discount - coalesce(p.paid, 0))), 0) AS debt,
               count(*) FILTER (WHERE s.total - s.discount - coalesce(p.paid, 0) > 0) AS debt_sales,
               min(s.date) AS first_at, max(s.date) AS last_at
        FROM sale s
        LEFT JOIN (SELECT "saleId", sum(amount) AS paid, sum(amount) FILTER (WHERE method <> $2) AS cash
                   FROM payment WHERE "saleId" IS NOT NULL GROUP BY "saleId") p ON p."saleId" = s.id
        WHERE s."customerId" = $1`, [id, OFFSET_METHOD]),
      this.dataSource.query(`
        SELECT count(*) AS cnt,
               coalesce(sum(r.total - r.discount), 0) AS net,
               coalesce(sum(coalesce(p.cash, 0)), 0) AS cash,
               max(r.date) AS last_at
        FROM "return" r
        LEFT JOIN (SELECT "returnsId", sum(amount) FILTER (WHERE method <> $2) AS cash
                   FROM payment WHERE "returnsId" IS NOT NULL GROUP BY "returnsId") p ON p."returnsId" = r.id
        WHERE r."customerId" = $1`, [id, OFFSET_METHOD]),
      this.dataSource.query(`
        SELECT count(*) AS cnt,
               coalesce(sum(pu.total - pu.discount), 0) AS net,
               coalesce(sum(coalesce(p.paid, 0)), 0) AS paid,
               coalesce(sum(greatest(0, pu.total - pu.discount - coalesce(p.paid, 0))), 0) AS owed,
               max(pu.date) AS last_at
        FROM purchase pu
        LEFT JOIN (SELECT "purchaseId", sum(amount) AS paid FROM payment WHERE "purchaseId" IS NOT NULL GROUP BY "purchaseId") p
          ON p."purchaseId" = pu.id
        WHERE pu."customerId" = $1`, [id]),
      this.dataSource.query(`
        SELECT pm.method, count(*) AS cnt, sum(pm.amount) AS amount
        FROM payment pm JOIN sale s ON s.id = pm."saleId"
        WHERE s."customerId" = $1 AND pm.amount > 0 AND pm.method <> $2
        GROUP BY pm.method ORDER BY amount DESC`, [id, OFFSET_METHOD]),
      this.dataSource.query(`
        SELECT pr.id, pr.name, pr.unit, sum(x.qty) AS qty, sum(x.amount) AS amount
        FROM (
          SELECT si."productId", si.quantity AS qty, si.quantity * si.price AS amount
          FROM sale_item si JOIN sale s ON s.id = si."saleId" WHERE s."customerId" = $1
          UNION ALL
          SELECT ri."productId", -ri.quantity, -(ri.quantity * ri.price)
          FROM return_item ri JOIN "return" r ON r.id = ri."returnsId" WHERE r."customerId" = $1
        ) x JOIN product pr ON pr.id = x."productId"
        GROUP BY pr.id HAVING sum(x.qty) <> 0
        ORDER BY amount DESC LIMIT 8`, [id]),
      this.dataSource.query(`
        WITH m AS (
          SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS start
        )
        SELECT to_char(m.start, 'YYYY-MM') AS month,
          coalesce((SELECT sum(total - discount) FROM sale
                    WHERE "customerId" = $1 AND date >= m.start AND date < m.start + interval '1 month'), 0) AS sales,
          coalesce((SELECT sum(total - discount) FROM "return"
                    WHERE "customerId" = $1 AND date >= m.start AND date < m.start + interval '1 month'), 0) AS returns
        FROM m ORDER BY m.start`, [id]),
    ]);

    const s: Row = sales[0];
    const r: Row = returns[0];
    const p: Row = purchases[0];

    const salesCount = num(s.cnt);
    const salesNet = money(s.net);
    const returnsNet = money(r.net);
    const lastAt = [s.last_at, r.last_at, p.last_at]
      .filter(Boolean)
      .map((value) => new Date(value as string).getTime())
      .reduce<number>((max, value) => Math.max(max, value), 0);
    const firstAt = s.first_at ? new Date(s.first_at as string).toISOString() : null;

    return {
      customer: {
        id: customer.id,
        username: customer.username,
        surname: customer.surname,
        phone: customer.phone,
        type: customer.type ?? null,
        createdAt: customer.createdAt,
        requisites: {
          orgName: customer.orgName ?? null,
          inn: customer.inn ?? null,
          bankName: customer.bankName ?? null,
          mfo: customer.mfo ?? null,
          account: customer.account ?? null,
          address: customer.address ?? null,
          director: customer.director ?? null,
        },
      },
      summary: {
        salesCount,
        salesGross: money(s.gross),
        salesDiscount: money(s.discount),
        salesNet,
        paid: money(s.paid),
        received: money(s.cash),
        debt: money(s.debt),
        debtSales: num(s.debt_sales),
        averageCheck: salesCount > 0 ? Math.round(salesNet / salesCount) : 0,
        returnsCount: num(r.cnt),
        returnsNet,
        refunded: money(r.cash),
        /** Sof aylanma: savdolar − qaytarishlar. */
        turnover: salesNet - returnsNet,
        purchasesCount: num(p.cnt),
        purchasesNet: money(p.net),
        purchasesPaid: money(p.paid),
        purchasesOwed: money(p.owed),
        operationsCount: salesCount + num(r.cnt) + num(p.cnt),
        firstSaleAt: firstAt,
        lastOperationAt: lastAt > 0 ? new Date(lastAt).toISOString() : null,
      },
      paymentMethods: methods.map((row: Row) => ({
        method: row.method as string,
        count: num(row.cnt),
        amount: money(row.amount),
      })),
      topProducts: products.map((row: Row) => ({
        id: row.id as number,
        name: row.name as string,
        unit: (row.unit as string) ?? null,
        quantity: qty(row.qty),
        amount: money(row.amount),
      })),
      months: months.map((row: Row) => ({
        month: row.month as string,
        sales: money(row.sales),
        returns: money(row.returns),
      })),
    };
  }

  /**
   * Savdo, qaytarish va xaridlar — bitta tarix (yangilari tepada), har birida qatorlar va to'lovlar bilan.
   * `debt` — faqat qarzi qolgan savdolar. `totals` — filtrdagi barcha operatsiyalar (hamma sahifalar) bo'yicha jamlanma.
   */
  async operations(id: number, page = 1, limit = 10, type?: OperationType, debt = false) {
    await this.requireCustomer(id);
    page = page > 0 ? page : 1;
    limit = limit > 0 ? Math.min(limit, OPERATIONS_MAX_LIMIT) : 10;

    const wanted = (['sale', 'return', 'purchase'] as const).filter((key) =>
      debt ? key === 'sale' : !type || key === type,
    );
    const union = wanted
      .map((key) => {
        const source = SOURCES[key];
        const parent = key === 'return' ? 'x."saleId"' : 'NULL::int';
        return `
          SELECT '${key}'::text AS type, x.id, x.date, x.total, x.discount, ${parent} AS sale_id, x."userId" AS user_id,
                 coalesce((SELECT sum(amount) FROM payment WHERE ${source.paymentKey} = x.id), 0) AS paid,
                 coalesce((SELECT sum(amount) FROM payment WHERE ${source.paymentKey} = x.id AND method <> $2), 0) AS cash
          FROM ${source.table} x WHERE x."customerId" = $1`;
      })
      .join('\nUNION ALL\n');
    // Qarz: summa (jami − chegirma) to'lovlardan katta — profil jamlanmasidagi qoida bilan bir xil.
    const where = debt ? 'WHERE ops.total - ops.discount - ops.paid > 0' : '';

    const [counted, rows]: [Row[], Row[]] = await Promise.all([
      this.dataSource.query(
        `SELECT count(*) AS total,
                count(*) FILTER (WHERE ops.type = 'sale') AS sales_cnt,
                coalesce(sum(ops.total - ops.discount) FILTER (WHERE ops.type = 'sale'), 0) AS sales,
                coalesce(sum(ops.paid) FILTER (WHERE ops.type = 'sale'), 0) AS sales_paid,
                count(*) FILTER (WHERE ops.type = 'sale' AND ops.total - ops.discount - ops.paid > 0) AS debt_cnt,
                coalesce(sum(greatest(0, ops.total - ops.discount - ops.paid)) FILTER (WHERE ops.type = 'sale'), 0) AS debt,
                count(*) FILTER (WHERE ops.type = 'return') AS returns_cnt,
                coalesce(sum(ops.total - ops.discount) FILTER (WHERE ops.type = 'return'), 0) AS returns,
                count(*) FILTER (WHERE ops.type = 'purchase') AS purchases_cnt,
                coalesce(sum(ops.total - ops.discount) FILTER (WHERE ops.type = 'purchase'), 0) AS purchases
         FROM (${union}) ops ${where}`,
        [id, OFFSET_METHOD],
      ),
      this.dataSource.query(
        `SELECT ops.*, u.username, u.surname
         FROM (${union}) ops LEFT JOIN "user" u ON u.id = ops.user_id
         ${where}
         ORDER BY ops.date DESC, ops.id DESC LIMIT $3 OFFSET $4`,
        [id, OFFSET_METHOD, limit, (page - 1) * limit],
      ),
    ]);

    // Qatorlar va to'lovlar faqat shu sahifadagi operatsiyalar uchun olinadi.
    const items = new Map<string, Row[]>();
    const payments = new Map<string, Row[]>();

    // Savdolardagi usta xizmatlari: usta, uning ulushi (savdo summasidan tashqari) va kompaniya ulushi (summa ichida).
    const saleIds = rows.filter((row) => row.type === 'sale').map((row) => row.id as number);
    const feeRows: Row[] = saleIds.length
      ? await this.dataSource.query(
          `SELECT f."saleId" AS op_id, f.amount, f."companyAmount" AS company_amount,
                  u.id AS master_id, u.username, u.surname
           FROM sale_master_fee f LEFT JOIN "user" u ON u.id = f."masterId"
           WHERE f."saleId" = ANY($1::int[]) ORDER BY f.id`, [saleIds])
      : [];

    await Promise.all(
      wanted.map(async (key) => {
        const ids = rows.filter((row) => row.type === key).map((row) => row.id as number);
        if (ids.length === 0) return;
        const source = SOURCES[key];
        const [itemRows, paymentRows]: [Row[], Row[]] = await Promise.all([
          this.dataSource.query(
            `SELECT i.${source.itemKey} AS op_id, pr.id AS product_id, pr.name, pr.unit, i.quantity, i.price
             FROM ${source.itemTable} i LEFT JOIN product pr ON pr.id = i."productId"
             WHERE i.${source.itemKey} = ANY($1::int[]) ORDER BY i.id`, [ids]),
          this.dataSource.query(
            `SELECT ${source.paymentKey} AS op_id, method, amount, date
             FROM payment WHERE ${source.paymentKey} = ANY($1::int[]) ORDER BY id`, [ids]),
        ]);
        for (const row of itemRows) {
          const bucket = `${key}:${row.op_id}`;
          items.set(bucket, [...(items.get(bucket) ?? []), row]);
        }
        for (const row of paymentRows) {
          const bucket = `${key}:${row.op_id}`;
          payments.set(bucket, [...(payments.get(bucket) ?? []), row]);
        }
      }),
    );

    const c = counted[0];
    const total = num(c.total);
    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      totals: {
        salesCount: num(c.sales_cnt),
        sales: money(c.sales),
        salesPaid: money(c.sales_paid),
        debtCount: num(c.debt_cnt),
        debt: money(c.debt),
        returnsCount: num(c.returns_cnt),
        returns: money(c.returns),
        purchasesCount: num(c.purchases_cnt),
        purchases: money(c.purchases),
      },
      data: rows.map((row) => {
        const net = money(row.total) - money(row.discount);
        const paid = money(row.paid);
        const bucket = `${row.type}:${row.id}`;
        return {
          type: row.type as OperationType,
          id: row.id as number,
          date: row.date,
          total: money(row.total),
          discount: money(row.discount),
          net,
          paid,
          received: money(row.cash),
          // Qarz faqat savdoda: qaytarish va xaridda "yopilmagan qism" boshqa ma'noda.
          debt: row.type === 'sale' ? Math.max(0, net - paid) : 0,
          saleId: (row.sale_id as number | null) ?? null,
          user: row.user_id
            ? { id: row.user_id as number, username: row.username as string, surname: row.surname as string }
            : null,
          items: (items.get(bucket) ?? []).map((item) => ({
            productId: (item.product_id as number | null) ?? null,
            name: (item.name as string | null) ?? null,
            unit: (item.unit as string | null) ?? null,
            quantity: qty(item.quantity),
            price: money(item.price),
            amount: Math.round(num(item.quantity) * num(item.price)),
          })),
          payments: (payments.get(bucket) ?? []).map((payment) => ({
            method: payment.method as string,
            amount: money(payment.amount),
            date: payment.date,
          })),
          masterFees: row.type === 'sale'
            ? feeRows
                .filter((fee) => fee.op_id === row.id)
                .map((fee) => ({
                  master: fee.master_id
                    ? { id: fee.master_id as number, username: fee.username as string, surname: fee.surname as string }
                    : null,
                  amount: money(fee.amount),
                  companyAmount: money(fee.company_amount),
                }))
            : [],
        };
      }),
    };
  }
}
