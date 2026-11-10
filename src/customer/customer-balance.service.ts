import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  BALANCE_PAY_METHOD,
  BALANCE_REFUND_METHOD,
  CONTRACT_METHOD,
  DEBT_METHOD,
  isNonCashMethod,
} from 'src/payment/payment-methods';
import { Payment } from 'src/payment/entities/payment.entity';
import { Return } from 'src/return/entities/return.entity';
import { Sale } from 'src/sale/entities/sale.entity';
import { User } from 'src/user/entities/user.entity';
import { TelegramBotService } from 'src/telegram/telegram-bot.service';
import { Customer } from './entities/customer.entity';
import { BalanceEntryType, CustomerBalanceEntry } from './entities/customer-balance-entry.entity';
import { AcceptPaymentDto, BALANCE_HISTORY_MAX_LIMIT, BalanceMoneyDto, BalancePayDto } from './dto/customer-balance.dto';

type Row = Record<string, unknown>;

const num = (value: unknown) => (value === null || value === undefined ? 0 : Number(value));
const money = (value: unknown) => Math.round(num(value));
const fmt = (value: number) => value.toLocaleString('ru-RU');

/**
 * `customer.balance` — balans yozuvlari yig'indisi. Trigger har bir yozuv qo'shilganda, o'zgarganda va
 * o'chganda (savdo/qaytarish/to'lov o'chirilganda kaskad bilan ham) uni qayta hisoblaydi, shuning uchun
 * mijoz qaytgan har bir javobda balans to'g'ri. Ishga tushganda bir marta hammasi qayta hisoblanadi.
 * Idempotent: har ishga tushishda xavfsiz takrorlanadi.
 */
const SYNC_SQL = `
CREATE OR REPLACE FUNCTION customer_balance_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    UPDATE customer
       SET balance = coalesce((SELECT sum(amount) FROM customer_balance_entry WHERE "customerId" = OLD."customerId"), 0)
     WHERE id = OLD."customerId";
  END IF;
  IF TG_OP <> 'DELETE' THEN
    UPDATE customer
       SET balance = coalesce((SELECT sum(amount) FROM customer_balance_entry WHERE "customerId" = NEW."customerId"), 0)
     WHERE id = NEW."customerId";
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS customer_balance_sync ON customer_balance_entry;
CREATE TRIGGER customer_balance_sync
  AFTER INSERT OR UPDATE OR DELETE ON customer_balance_entry
  FOR EACH ROW EXECUTE PROCEDURE customer_balance_sync();

UPDATE customer c
   SET balance = x.total
  FROM (SELECT c2.id, coalesce(sum(e.amount), 0)::int AS total
          FROM customer c2 LEFT JOIN customer_balance_entry e ON e."customerId" = c2.id
         GROUP BY c2.id) x
 WHERE x.id = c.id AND c.balance IS DISTINCT FROM x.total;
`;

/** Balansga pul kiritish/chiqarishda tanlab bo'lmaydigan usullar: ular pul emas yoki qarz belgisi. */
const assertCashMethod = (method: string) => {
  if (isNonCashMethod(method) || method === DEBT_METHOD || method === CONTRACT_METHOD) {
    throw new BadRequestException('Этот способ оплаты нельзя выбрать для баланса');
  }
};

interface EntryInput {
  customerId: number;
  amount: number;
  type: BalanceEntryType;
  method?: string | null;
  saleId?: number | null;
  returnId?: number | null;
  paymentId?: number | null;
  userId?: number | null;
  note?: string | null;
}

/**
 * Mijoz balansi (avans / mijozning do'kondagi puli).
 *
 * Pul balansga ikki yo'l bilan tushadi: mijoz oldindan pul beradi (`deposit`) yoki qaytarish summasi naqd
 * berilmay balansga yoziladi (`return`). Balansdagi pul savdoni yoki eski qarzni to'lashga ketadi (`sale`,
 * savdoda «С баланса» to'lovi) yoki mijozga naqd qaytarib beriladi (`withdraw`).
 *
 * Balans hech qachon manfiy bo'lmaydi: har bir chiqimda mijoz qatori qulflanadi (`FOR UPDATE`) va
 * yig'indi qayta tekshiriladi. Balansga pul tushganda qarz avtomatik yopilmaydi — kassir o'zi
 * «Погасить долг с баланса» ni bosadi.
 */
@Injectable()
export class CustomerBalanceService implements OnModuleInit {

  constructor(
    private readonly dataSource: DataSource,
    private readonly telegramBot: TelegramBotService,
  ) { }

  async onModuleInit() {
    await this.dataSource.query(SYNC_SQL);
  }

  // ------------------------------------------------------------------ boshqa servislar tranzaksiyasi ichida

  /** Joriy balans (qulfsiz) — oldindan tekshirish uchun; yakuniy tekshiruv `spendOnSale` da qulf bilan. */
  async balanceOf(customerId: number): Promise<number> {
    const [row]: Row[] = await this.dataSource.query(
      'SELECT coalesce(sum(amount), 0) AS balance FROM customer_balance_entry WHERE "customerId" = $1',
      [customerId],
    );
    return money(row.balance);
  }

  /** Mijoz qatorini qulflaydi va joriy balansni (yozuvlar yig'indisi) qaytaradi. */
  async lock(em: EntityManager, customerId: number): Promise<number> {
    const found: Row[] = await em.query('SELECT id FROM customer WHERE id = $1 FOR UPDATE', [customerId]);
    if (found.length === 0) throw new NotFoundException('Контрагент не найден');
    const [row]: Row[] = await em.query(
      'SELECT coalesce(sum(amount), 0) AS balance FROM customer_balance_entry WHERE "customerId" = $1',
      [customerId],
    );
    return money(row.balance);
  }

  /** Savdoni balansdan to'laydi: savdoga «С баланса» to'lovi va balansdan chiqim yozuvi. Balans yetmasa — rad. */
  async spendOnSale(em: EntityManager, input: { customerId: number; saleId: number; amount: number; userId?: number | string | null }) {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestException('Сумма оплаты с баланса должна быть целым числом больше нуля');
    }
    const balance = await this.lock(em, input.customerId);
    if (input.amount > balance) {
      throw new BadRequestException(`На балансе клиента ${fmt(balance)} сум — меньше суммы оплаты (${fmt(input.amount)})`);
    }
    const payment = await em.save(em.create(Payment, {
      sale: { id: input.saleId } as Sale,
      amount: input.amount,
      method: BALANCE_PAY_METHOD,
    }));
    await this.addEntry(em, {
      customerId: input.customerId,
      amount: -input.amount,
      type: 'sale',
      saleId: input.saleId,
      paymentId: payment.id,
      userId: await this.actorId(em, input.userId),
    });
    return payment;
  }

  /** Qaytarish summasini balansga yozadi: qaytarishga «На баланс» to'lovi va balansga kirim yozuvi. */
  async creditReturn(em: EntityManager, input: { customerId: number; returnId: number; amount: number; userId?: number | string | null }) {
    await this.lock(em, input.customerId);
    const payment = await em.save(em.create(Payment, {
      returns: { id: input.returnId } as Return,
      amount: input.amount,
      method: BALANCE_REFUND_METHOD,
    }));
    await this.addEntry(em, {
      customerId: input.customerId,
      amount: input.amount,
      type: 'return',
      returnId: input.returnId,
      paymentId: payment.id,
      userId: await this.actorId(em, input.userId),
    });
    return payment;
  }

  /**
   * Savdo boshqa kontragentga o'tkazilganda (kassir adashgan). Balans mijozga bog'liq, shuning uchun:
   *  - savdoning «С баланса» to'lovlari bekor qilinadi — pul eski mijoz balansiga qaytadi, savdoda qarz qoladi;
   *  - shu savdodan qaytarishlar balansga yozilgan bo'lsa — yozuvlar yangi kontragentga o'tadi. Eski mijoz
   *    o'sha pulni allaqachon ishlatgan bo'lsa (balansi yetmasa) — rad etiladi.
   * Qaytaradi: bekor qilingan «С баланса» summasi.
   */
  async followSaleCustomer(em: EntityManager, saleId: number, fromCustomerId: number | null, toCustomerId: number) {
    if (!fromCustomerId || fromCustomerId === toCustomerId) return 0;

    const [spent]: Row[] = await em.query(
      `SELECT coalesce(sum(amount), 0) AS amount FROM payment WHERE "saleId" = $1 AND method = $2`,
      [saleId, BALANCE_PAY_METHOD],
    );
    // To'lov o'chsa unga bog'langan balans yozuvi ham kaskad bilan o'chadi.
    await em.query(`DELETE FROM payment WHERE "saleId" = $1 AND method = $2`, [saleId, BALANCE_PAY_METHOD]);

    const credits: Row[] = await em.query(
      `SELECT e.id, e.amount FROM customer_balance_entry e JOIN "return" r ON r.id = e."returnsId"
        WHERE r."saleId" = $1 AND e."customerId" = $2 AND e.type = 'return'`,
      [saleId, fromCustomerId],
    );
    const credited = credits.reduce((sum, row) => sum + money(row.amount), 0);
    if (credited > 0) {
      const balance = await this.lock(em, fromCustomerId);
      if (balance < credited) {
        throw new BadRequestException(
          `Возврат по этой продаже (${fmt(credited)} сум) зачислен на баланс клиента, и эти деньги уже использованы. Сменить контрагента нельзя`,
        );
      }
      await this.lock(em, toCustomerId);
      await em.query(
        `UPDATE customer_balance_entry SET "customerId" = $1 WHERE id = ANY($2::int[])`,
        [toCustomerId, credits.map((row) => row.id)],
      );
    }
    return money(spent.amount);
  }

  // ------------------------------------------------------------------ API

  /** Balans, qarz va balans harakatlari tarixi (yangilari tepada). */
  async history(customerId: number, page = 1, limit = 20) {
    page = page > 0 ? page : 1;
    limit = limit > 0 ? Math.min(limit, BALANCE_HISTORY_MAX_LIMIT) : 20;
    await this.requireCustomer(customerId);

    const [totalRows, debtRows, rows] = await Promise.all([
      this.dataSource.query<Row[]>(
        `SELECT count(*) AS cnt,
                coalesce(sum(amount), 0) AS balance,
                coalesce(sum(amount) FILTER (WHERE type = 'deposit'), 0) AS deposited,
                coalesce(sum(amount) FILTER (WHERE type = 'return'), 0) AS returned,
                coalesce(-sum(amount) FILTER (WHERE type = 'sale'), 0) AS spent,
                coalesce(-sum(amount) FILTER (WHERE type = 'withdraw'), 0) AS withdrawn
           FROM customer_balance_entry WHERE "customerId" = $1`,
        [customerId],
      ),
      this.debtOf(customerId),
      this.dataSource.query<Row[]>(
        `SELECT e.id, e.type, e.amount, e.method, e.note, e.date, e."saleId" AS sale_id, e."returnsId" AS return_id,
                u.id AS user_id, u.username, u.surname
           FROM customer_balance_entry e LEFT JOIN "user" u ON u.id = e."userId"
          WHERE e."customerId" = $1
          ORDER BY e.date DESC, e.id DESC
          LIMIT $2 OFFSET $3`,
        [customerId, limit, (page - 1) * limit],
      ),
    ]);
    const [totals] = totalRows;
    const [debt] = debtRows;

    const total = num(totals.cnt);
    return {
      balance: money(totals.balance),
      debt: money(debt.debt),
      debtSales: num(debt.debt_sales),
      totals: {
        deposited: money(totals.deposited),
        returned: money(totals.returned),
        spent: money(totals.spent),
        withdrawn: money(totals.withdrawn),
      },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: rows.map((row) => ({
        id: row.id as number,
        type: row.type as BalanceEntryType,
        amount: money(row.amount),
        method: (row.method as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        date: row.date,
        saleId: (row.sale_id as number | null) ?? null,
        returnId: (row.return_id as number | null) ?? null,
        user: row.user_id
          ? { id: row.user_id as number, username: row.username as string, surname: row.surname as string }
          : null,
      })),
    };
  }

  /** Mijoz pul olib keldi — balansga yoziladi (kassaga kirim). Qarz avtomatik yopilmaydi. */
  async deposit(customerId: number, dto: BalanceMoneyDto) {
    assertCashMethod(dto.method);
    const entry = await this.dataSource.transaction(async (em) => {
      await this.lock(em, customerId);
      return this.addEntry(em, {
        customerId,
        amount: dto.amount,
        type: 'deposit',
        method: dto.method,
        userId: await this.actorId(em, dto.user_id),
        note: dto.note,
      });
    });
    this.telegramBot.notifyBalance(entry.id);
    return this.history(customerId, 1, 20);
  }

  /** Balansdagi pul mijozga qaytarib berildi (kassadan chiqim). Balansdan ortiq bo'lmaydi. */
  async withdraw(customerId: number, dto: BalanceMoneyDto) {
    assertCashMethod(dto.method);
    const entry = await this.dataSource.transaction(async (em) => {
      const balance = await this.lock(em, customerId);
      if (dto.amount > balance) {
        throw new BadRequestException(`На балансе клиента только ${fmt(balance)} сум`);
      }
      return this.addEntry(em, {
        customerId,
        amount: -dto.amount,
        type: 'withdraw',
        method: dto.method,
        userId: await this.actorId(em, dto.user_id),
        note: dto.note,
      });
    });
    this.telegramBot.notifyBalance(entry.id);
    return this.history(customerId, 1, 20);
  }

  /**
   * Qarzni balansdan yopish: `sale_id` berilsa — shu savdo, aks holda eng eski qarzdan boshlab.
   * Har bir savdoga «С баланса» to'lovi yoziladi. Qaytaradi: qaysi savdoga qancha ketgani va qolgan balans.
   */
  async payDebts(customerId: number, dto: BalancePayDto) {
    const result = await this.dataSource.transaction(async (em) => {
      const balance = await this.lock(em, customerId);
      if (balance <= 0) throw new BadRequestException('На балансе клиента нет денег');
      if (dto.amount !== undefined && dto.amount > balance) {
        throw new BadRequestException(`На балансе клиента только ${fmt(balance)} сум`);
      }

      const debts = await this.debtSales(em, customerId, dto.sale_id);
      if (debts.length === 0) throw new BadRequestException('У клиента нет долгов');
      if (dto.sale_id && dto.amount !== undefined && dto.amount > money(debts[0].debt)) {
        throw new BadRequestException('Сумма больше остатка долга');
      }

      const userId = await this.actorId(em, dto.user_id);
      let budget = Math.min(balance, dto.amount ?? balance);
      const paid: { saleId: number; amount: number }[] = [];
      for (const sale of debts) {
        if (budget <= 0) break;
        const amount = Math.min(money(sale.debt), budget);
        await this.spendOnSale(em, { customerId, saleId: sale.id as number, amount, userId });
        paid.push({ saleId: sale.id as number, amount });
        budget -= amount;
      }

      const total = paid.reduce((sum, item) => sum + item.amount, 0);
      return { paid: total, sales: paid, balance: balance - total };
    });
    return result;
  }

  /**
   * Mijoz qarz uchun pul berdi (masalan qarz 500 000, berdi 1 000 000). Pul qarzni yopadi: `sale_id` — faqat shu
   * savdo, bo'lmasa eng eski qarzdan boshlab; har bir savdoga shu usuldagi (naqd, karta …) to'lov yoziladi.
   * Ortgan pul (qaytim) `keep_change` bo'lsa (standart) — mijoz balansiga, aks holda qaytim qo'lga berilgan.
   * Qarz bo'lmasa va qaytim balansga yozilsa — butun summa balansga tushadi.
   * Qaytaradi: qaysi savdoga qancha, balansga qancha tushgani va yangi balans.
   */
  async acceptPayment(customerId: number, dto: AcceptPaymentDto) {
    assertCashMethod(dto.method);
    const keepChange = dto.keep_change !== false;

    const { result, depositId } = await this.dataSource.transaction(async (em) => {
      const balance = await this.lock(em, customerId);
      const debts = await this.debtSales(em, customerId, dto.sale_id);
      if (debts.length === 0 && !keepChange) throw new BadRequestException('У клиента нет долгов');

      const userId = await this.actorId(em, dto.user_id);
      let budget = dto.amount;
      const paid: { saleId: number; amount: number }[] = [];
      for (const sale of debts) {
        if (budget <= 0) break;
        const amount = Math.min(money(sale.debt), budget);
        await em.save(em.create(Payment, { sale: { id: sale.id as number } as Sale, amount, method: dto.method }));
        paid.push({ saleId: sale.id as number, amount });
        budget -= amount;
      }

      let deposited = 0;
      let entryId: number | null = null;
      if (budget > 0 && keepChange) {
        const ids = paid.map((item) => `#${item.saleId}`).join(', ');
        const entry = await this.addEntry(em, {
          customerId,
          amount: budget,
          type: 'deposit',
          method: dto.method,
          userId,
          note: dto.note?.trim() || (ids ? `Сдача с оплаты долга (продажа ${ids})` : null),
        });
        deposited = budget;
        entryId = entry.id;
      }

      return {
        depositId: entryId,
        result: {
          paid: paid.reduce((sum, item) => sum + item.amount, 0),
          sales: paid,
          deposited,
          // Qaytim qo'lga berilgan bo'lsa — qancha.
          change: keepChange ? 0 : budget,
          balance: balance + deposited,
        },
      };
    });

    if (depositId) this.telegramBot.notifyBalance(depositId);
    return result;
  }

  // ------------------------------------------------------------------ yordamchi

  /**
   * Qarzi qolgan savdolar (eskisi birinchi): `saleId` berilsa — faqat shu savdo (u shu mijozniki bo'lishi va qarzi
   * qolgan bo'lishi shart), aks holda mijozning barcha qarzli savdolari.
   */
  private async debtSales(em: EntityManager, customerId: number, saleId?: number) {
    const sales: Row[] = await em.query(
      `SELECT s.id, s."customerId" AS customer_id,
              s.total - s.discount - coalesce((SELECT sum(p.amount) FROM payment p WHERE p."saleId" = s.id), 0) AS debt
         FROM sale s
        WHERE ${saleId ? 's.id = $1' : 's."customerId" = $1'}
        ORDER BY s.date, s.id`,
      [saleId ?? customerId],
    );
    if (saleId) {
      const sale = sales[0];
      if (!sale) throw new NotFoundException('Продажа не найдена');
      if (sale.customer_id !== customerId) throw new BadRequestException('Эта продажа другого контрагента');
      if (money(sale.debt) <= 0) throw new BadRequestException('По этой продаже долга нет');
    }
    return sales.filter((sale) => money(sale.debt) > 0);
  }

  private async requireCustomer(id: number) {
    if (!(await this.dataSource.manager.exists(Customer, { where: { id } }))) {
      throw new NotFoundException('Контрагент не найден');
    }
  }

  /** Mijozning hozirgi savdo qarzi — profil va ro'yxatdagi qoida bilan bir xil. */
  private debtOf(customerId: number) {
    return this.dataSource.query<Row[]>(
      `SELECT coalesce(sum(greatest(0, s.total - s.discount - coalesce(p.paid, 0))), 0) AS debt,
              count(*) FILTER (WHERE s.total - s.discount - coalesce(p.paid, 0) > 0) AS debt_sales
         FROM sale s
         LEFT JOIN LATERAL (SELECT sum(amount) AS paid FROM payment WHERE "saleId" = s.id) p ON true
        WHERE s."customerId" = $1`,
      [customerId],
    );
  }

  /** Xodim bazada bo'lmasa (eski sessiya) — amal baribir yoziladi, faqat kim qilgani bo'sh qoladi. */
  private async actorId(em: EntityManager, userId?: number | string | null) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id < 1) return null;
    return (await em.exists(User, { where: { id } })) ? id : null;
  }

  private addEntry(em: EntityManager, input: EntryInput) {
    return em.save(em.create(CustomerBalanceEntry, {
      customer: { id: input.customerId } as Customer,
      amount: input.amount,
      type: input.type,
      method: input.method ?? null,
      sale: input.saleId ? ({ id: input.saleId } as Sale) : null,
      returns: input.returnId ? ({ id: input.returnId } as Return) : null,
      payment: input.paymentId ? ({ id: input.paymentId } as Payment) : null,
      user: input.userId ? ({ id: input.userId } as User) : null,
      note: input.note?.trim() || null,
    }));
  }
}
