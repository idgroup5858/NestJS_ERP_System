import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateSaleDto, SaleMasterFeeDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { ChangeSaleCustomerDto } from './dto/change-sale-customer.dto';
import { AddSaleMasterFeeDto } from './dto/add-sale-master-fee.dto';
import { SaleListFilter } from './dto/sale-list-query.dto';
import { Sale } from './entities/sale.entity';
import { SaleMasterFee } from './entities/sale-master-fee.entity';
import { SalePaymentItem } from './entities/sale-payment-item.entity';
import { PaySaleItemsDto } from './dto/pay-sale-items.dto';
import { SaleItem } from 'src/sale_items/entities/sale_item.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, Repository } from 'typeorm';
import { SaleItemsService } from 'src/sale_items/sale_items.service';
import { PaymentService } from 'src/payment/payment.service';
import { BALANCE_PAY_METHOD, CONTRACT_METHOD, DEBT_METHOD, isNonCashMethod } from 'src/payment/payment-methods';
import { CustomerBalanceService } from 'src/customer/customer-balance.service';
import { ContractService } from 'src/contract/contract.service';
import { StockService } from 'src/stock/stock.service';
import { TelegramBotService } from 'src/telegram/telegram-bot.service';
import { roundMoney, roundQuantity } from 'src/common/quantity';
import { Contract } from 'src/contract/entities/contract.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { Payment } from 'src/payment/entities/payment.entity';
import { Return } from 'src/return/entities/return.entity';
import { User } from 'src/user/entities/user.entity';

/** Savdoda chegirma umumiy summaning shu foizidan oshmasligi kerak. */
const MAX_SALE_DISCOUNT_PERCENT = 20;

/** Bir savdodagi usta xizmatlari soni chegarasi. */
const MAX_MASTER_FEES = 20;

@Injectable()
export class SaleService {

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    private readonly saleItemsService: SaleItemsService,
    private readonly paymentService: PaymentService,
    private readonly stockService: StockService,
    private readonly telegramBot: TelegramBotService,
    private readonly contractService: ContractService,
    private readonly balanceService: CustomerBalanceService,

  ) { }


  async createFullSale(createSaleDto: CreateSaleDto) {

    // Shartnoma ochilsinmi: kassada aniq tanlangan bo'lsa (`open_contract`) — shu; aks holda "По договору" to'lovi bo'lsa.
    // Kontragent majburiy emas — buxgalter uni shartnoma kartochkasida tanlaydi yoki ochadi.
    const byContract = createSaleDto.open_contract
      ?? (createSaleDto.payments ?? []).some((payment) => payment.method === CONTRACT_METHOD);

    // Usta xizmati — oldindan tekshiriladi. Ustaning ulushi savdo summasiga kirmaydi (alohida hisoblanadi),
    // kompaniya ulushi esa tovarlar bilan birga savdo summasiga qo'shiladi.
    const masterFees = await this.normalizeMasterFees(createSaleDto.master_fees);

    let total:number = 0;

    for (const item of createSaleDto.items) {
      total += item.quantity * item.price;
    }
    total = roundMoney(total + masterFees.reduce((sum, fee) => sum + fee.companyAmount, 0));

    const discount = Math.round(Number(createSaleDto.discount) || 0);
    if (discount < 0 || discount > Math.floor(total * MAX_SALE_DISCOUNT_PERCENT / 100)) {
      throw new BadRequestException(`Скидка не может превышать ${MAX_SALE_DISCOUNT_PERCENT}% суммы продажи`);
    }

    // To'lov savdo summasidan oshmasligi kerak. Kassa va server summani har xil hisoblasa (masalan, server eski
    // versiyada qolib, usta xizmatidan kompaniya ulushini bilmasa) — savdo noto'g'ri yozilmasdan rad etiladi.
    const payments = createSaleDto.payments ?? [];
    const paid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    if (paid > total - discount) {
      throw new BadRequestException(
        `Оплата (${paid.toLocaleString('ru-RU')}) больше суммы продажи (${(total - discount).toLocaleString('ru-RU')}) — обновите страницу и оформите продажу заново`,
      );
    }

    // "С баланса": savdoning bir qismi (yoki hammasi) mijozning balansidan. Kontragent majburiy, balans yetishi kerak.
    // Boshqa "pul emas" usullar (zachyot, "На баланс") kassada tanlanmaydi.
    const isBalance = (method?: string) => method?.trim() === BALANCE_PAY_METHOD;
    if (payments.some((payment) => isNonCashMethod(payment.method) && !isBalance(payment.method))) {
      throw new BadRequestException('Этот способ оплаты нельзя выбрать в кассе');
    }
    const balancePaid = payments
      .filter((payment) => isBalance(payment.method))
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    if (balancePaid > 0) {
      if (!createSaleDto.customer_id) throw new BadRequestException('Для оплаты с баланса выберите контрагента');
      if (!Number.isInteger(balancePaid)) throw new BadRequestException('Сумма оплаты с баланса должна быть целым числом');
      const balance = await this.balanceService.balanceOf(createSaleDto.customer_id);
      if (balancePaid > balance) {
        throw new BadRequestException(
          `На балансе клиента ${balance.toLocaleString('ru-RU')} сум — меньше суммы оплаты с баланса (${balancePaid.toLocaleString('ru-RU')})`,
        );
      }
    }

    // Sotuv tranzaksiyasiz yoziladi, shuning uchun qoldiq keyinroq topilmasa
    // sotuv yarim-yozilgan holda qolmasligi uchun avval tekshiriladi.
    await this.stockService.assertAvailable(createSaleDto.items, true);

    const sale = this.saleRepository.create({
      customer: createSaleDto.customer_id ? { id: createSaleDto.customer_id } : undefined,
      user: { id: createSaleDto.user_id },
      total,
      discount
    });

    await this.saleRepository.save(sale);

    // Balansdan to'lov — qulf ostida qayta tekshiriladi (shu orada balans ishlatilgan bo'lishi mumkin).
    // O'tmasa savdoning boshqa qismlari hali yozilmagan: savdo o'chiriladi, kassir qayta urinadi.
    if (balancePaid > 0) {
      try {
        await this.saleRepository.manager.transaction((em) => this.balanceService.spendOnSale(em, {
          customerId: createSaleDto.customer_id,
          saleId: sale.id,
          amount: balancePaid,
          userId: createSaleDto.user_id,
        }));
      } catch (error) {
        await this.saleRepository.delete(sale.id);
        throw error;
      }
    }

    if (masterFees.length > 0) {
      await this.saleRepository.manager.save(
        masterFees.map((fee) => this.saleRepository.manager.create(SaleMasterFee, {
          sale: { id: sale.id } as Sale,
          master: { id: fee.masterId } as User,
          amount: fee.amount,
          companyAmount: fee.companyAmount,
          note: fee.note,
        })),
      );
    }

    for (const item of createSaleDto.items) {
      await this.saleItemsService.create({
        ...item,
        sale_id: sale.id
      });
    }

    for (const payment of payments) {
      // "С баланса" yuqorida balans yozuvi bilan birga yozildi.
      if (isBalance(payment.method)) continue;
      await this.paymentService.create({
        ...payment,
        sale_id: sale.id
      });
    }


    for(const item of createSaleDto.items){
      await this.stockService.updateFilter(item)
    }

    // Telegram ga (javobni kutmasdan — internet boʻlmasa ham savdo oʻtadi).
    this.telegramBot.notifySale(sale.id);

    const created = await this.saleRepository.findOne({
      where: { id: sale.id },
      relations: ['items', 'payments']
    });

    // "По договору": shartnoma va kuzatuv vazifasi avtomatik ochiladi. Savdo allaqachon yozilgan,
    // shuning uchun shartnoma ochilmasa savdo bekor bo'lmaydi: xato javobda qaytadi (admin qayta urinishi mumkin).
    let contract: { id: number; number: string } | null = null;
    let contractError: string | null = null;
    if (byContract) {
      try {
        const made = await this.contractService.createFromSale(sale.id);
        contract = { id: made.id, number: made.number };
      } catch (error) {
        contractError = error instanceof Error ? error.message : 'Не удалось создать договор';
        new Logger(SaleService.name).error(`Sale #${sale.id}: договор не создан: ${contractError}`);
      }
    }

    return Object.assign(created as Sale, { contract, contractError });
  }




  async findAll() {

   return this.saleRepository.find({
      relations: ["items", "payments", "items.product", "customer", "user"]
    });
  }

  async findAllWithTotalDebt() {
  const sales = await this.saleRepository.find({
    relations: [
      "items",
      "payments",
      "items.product",
      "customer",
      "user"
    ]
  });

  return sales.filter((sale) => (
    sale.total >sale.payments?.reduce((sum, p) =>( sum + Number(p.amount || 0)), 0)+sale.discount
  )).map((sale) => {
    const totalPaid = sale.payments?.reduce((sum, p) => {
      return sum + Number(p.amount || 0);
    }, 0);

    return {
      ...sale,
      totalPaid,
    };
  });
}


  async findAllWithRange(startDate:string,endDate:string){
    const start= new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const result = await this.saleRepository.find({
      where:{
        date:Between(start, end)
      },
      //relations: ["items", "payments", "items.product", "customer", "user"]
    })

    return result;
  }


  async findTodaySales() {
      const start = new Date();
      const end = new Date();

      start.setHours(0, 0, 0, 0);       // bugun 00:00:00
      end.setHours(23, 59, 59, 999);    // bugun 23:59:59

      const result = await this.saleRepository.find({
        where: {
          date: Between(start, end),
        },
        // relations: ["items", "payments", "items.product", "customer", "user"]
      });

      return result;
  }

  async findThisWeekSales() {
      const now = new Date();
      const start = new Date(now);

      const day = now.getDay(); // Yakshanba=0, Dushanba=1 ...
      const diff = day === 0 ? 6 : day - 1; 
      // Agar yakshanba bo‘lsa 6 kun orqaga, aks holda day-1

      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);

      const result = await this.saleRepository.find({
        where: {
          date: Between(start, now),
        },
        // relations: ["items", "payments", "items.product", "customer", "user"]
      });

      return result;
    }


  async findThisMonthSales() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);

        start.setHours(0, 0, 0, 0);

        const result = await this.saleRepository.find({
          where: {
            date: Between(start, now),
          },
          relations: ["items", "payments", "items.product", "customer", "user"]
        });

    return result;
}


  async findAllPag(page: number, limit: number) {

    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.saleRepository.findAndCount({
      skip,
      take: limit,
      order: { id: 'DESC' }, // ixtiyoriy
      relations: ["items", "payments", "items.product", "customer", "user"]
    });

    return {
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        
      },
      data
    };


  }



/**
 * Savdolar ro'yxati: qidiruv va filtrlar bilan (`SaleListFilter` ga qarang), sahifalab, yangilari tepada.
 * Har bir savdoda usta xizmatlari (usta nomi va summalar) ham bor — ro'yxatda kim xizmat ko'rsatgani ko'rinadi.
 * Xodimlarning parol xeshi chiqmaydi (faqat kerakli maydonlar tanlanadi).
 */
async findAllPagSearch(page: number, limit: number, filter: SaleListFilter = {}) {
  page = page > 0 ? page : 1;
  limit = limit > 0 ? Math.min(limit, 100) : 10;

  const skip = (page - 1) * limit;

  const query = this.saleRepository.createQueryBuilder('sale')
  .leftJoinAndSelect('sale.items', 'items')
  .leftJoinAndSelect('sale.payments', 'payments')
  .leftJoin('sale.user', 'seller')
  .addSelect(['seller.id', 'seller.username', 'seller.surname', 'seller.email', 'seller.phone', 'seller.role'])
  .leftJoinAndSelect('items.warehouse', 'warehouse')
  .leftJoinAndSelect('items.product', 'product')
  .leftJoinAndSelect('sale.customer', 'customer')
  .leftJoin('sale.masterFees', 'fee')
  .addSelect(['fee.id', 'fee.amount', 'fee.companyAmount'])
  .leftJoin('fee.master', 'master')
  .addSelect(['master.id', 'master.username', 'master.surname']);

  // Qidiruv: kontragent (ism, tashkilot, telefon), sotgan xodim, usta yoki savdo raqami.
  const term = filter.search?.trim();
  if (term) {
    query.andWhere(new Brackets((qb) => {
      qb.where(`concat_ws(' ', customer.username, customer.surname) ILIKE :search`)
        .orWhere('customer.orgName ILIKE :search')
        .orWhere('customer.phone ILIKE :search')
        .orWhere(`concat_ws(' ', seller.username, seller.surname) ILIKE :search`)
        .orWhere(
          `EXISTS (SELECT 1 FROM sale_master_fee sf JOIN "user" su ON su.id = sf."masterId"
                    WHERE sf."saleId" = sale.id AND concat_ws(' ', su.username, su.surname) ILIKE :search)`,
        );
      const number = /^#?(\d{1,9})$/.exec(term);
      if (number) qb.orWhere('sale.id = :saleNumber', { saleNumber: Number(number[1]) });
    }), { search: `%${term}%` });
  }
  if (filter.debt) {
    query.andWhere(
      `sale.total - sale.discount > coalesce((SELECT sum(pd.amount) FROM payment pd WHERE pd."saleId" = sale.id), 0)`,
    );
  }
  if (filter.masterId) {
    query.andWhere(
      `EXISTS (SELECT 1 FROM sale_master_fee mf WHERE mf."saleId" = sale.id AND mf."masterId" = :masterId)`,
      { masterId: filter.masterId },
    );
  }
  if (filter.userId) query.andWhere('seller.id = :sellerId', { sellerId: filter.userId });
  if (filter.customerId) query.andWhere('customer.id = :customerId', { customerId: filter.customerId });

  const [data, total] = await query
    .orderBy('sale.id', 'DESC')
    .skip(skip)
    .take(limit)
    .getManyAndCount();

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data,
  };
}


  async findOne(id: number) {

    const checkSale = await this.saleRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Прдоажа");

    return checkSale;
  }

  /**
   * Savdo tafsiloti: har bir qatordan qancha qaytarilgani (`returned`) va
   * qaytarishlarning chegirmadan keyingi jami summasi (`returnedTotal`) bilan.
   */
  async findDetail(id: number) {

    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: [
        "items", "items.product", "items.warehouse", "items.returnItems", "items.paymentAllocations",
        "payments", "payments.allocations", "payments.allocations.saleItem", "customer", "user", "returns",
      ],
      order: { items: { id: "ASC" }, payments: { id: "ASC" } }
    });
    if (!sale) throw new NotFoundException("Не найден Прдоажа");

    const { items, returns, payments, ...rest } = sale;

    return {
      ...rest,
      // `returned` — qaytarilgani, `paid` — alohida shu tovar uchun to'langani ("310 metrdan 10 metri uchun").
      items: items.map(({ returnItems, paymentAllocations, ...item }) => ({
        ...item,
        returned: roundQuantity(returnItems.reduce((sum, r) => sum + r.quantity, 0)),
        paid: roundQuantity(paymentAllocations.reduce((sum, a) => sum + a.quantity, 0)),
      })),
      // To'lov aniq tovarlar uchun bo'lsa — `allocations`: qaysi qator, qancha miqdor va summa.
      payments: payments.map(({ allocations, ...payment }) => ({
        ...payment,
        allocations: (allocations ?? []).map((allocation) => ({
          saleItemId: allocation.saleItem?.id ?? null,
          quantity: allocation.quantity,
          amount: allocation.amount,
        })),
      })),
      returnedTotal: returns.reduce((sum, r) => sum + r.total - r.discount, 0),
      // Savdoga bog'langan shartnoma (bo'lmasa `null`): ekranda ko'rsatiladi, "По договору" ga o'tkazish uchun kerak.
      contract: await this.contractService.briefBySale(id),
      // Usta xizmati: ustaga beriladigan haqlar (savdo summasiga kirmaydi) va kompaniya ulushi (`sale.total` ichida).
      ...(await this.masterFeesOf(id)),
    };
  }

  /**
   * Usta xizmati qatorlarini tekshiradi: usta mavjud; ustaning ulushi va kompaniya ulushi — butun, manfiy emas
   * (butun xizmat kompaniyaga qolishi ham mumkin). Ikkalasi 0 bo'lishi ham mumkin — kassir summani yozmagan:
   * usta savdoga bog'lanadi, summalar 0 bo'lib qoladi.
   */
  private async normalizeMasterFees(fees?: SaleMasterFeeDto[]) {
    if (!fees || fees.length === 0) return [];
    if (!Array.isArray(fees) || fees.length > MAX_MASTER_FEES) {
      throw new BadRequestException(`Услуг мастеров в одной продаже не больше ${MAX_MASTER_FEES}`);
    }

    const valid = (value: number) => Number.isInteger(value) && value >= 0 && value <= 1_000_000_000;
    const result: { masterId: number; amount: number; companyAmount: number; note: string | null }[] = [];
    for (const fee of fees) {
      const masterId = Number(fee?.master_id);
      const amount = Number(fee?.amount);
      const companyAmount = Number(fee?.company_amount ?? 0);
      if (!Number.isInteger(masterId) || masterId < 1) throw new BadRequestException('Выберите мастера для услуги');
      if (!valid(amount) || !valid(companyAmount)) {
        throw new BadRequestException('Сумма услуги мастера должна быть целым неотрицательным числом');
      }
      const master = await this.saleRepository.manager.findOneBy(User, { id: masterId });
      if (!master) throw new BadRequestException(`Мастер #${masterId} не найден`);
      const note = typeof fee.note === 'string' ? fee.note.trim().slice(0, 200) : '';
      result.push({ masterId, amount, companyAmount, note: note || null });
    }
    return result;
  }

  /**
   * Savdodagi usta xizmatlari (parol xeshi chiqmaydi). `masterFeeTotal` — ustalarga (savdo summasidan tashqari),
   * `masterFeeCompanyTotal` — kompaniya ulushi (`sale.total` ichida).
   */
  private async masterFeesOf(saleId: number) {
    const rows: {
      id: number; amount: number; company_amount: number; note: string | null; created_at: Date;
      payment_method: string | null; master_id: number | null; username: string | null; surname: string | null;
    }[] = await this.saleRepository.query(
      `SELECT f.id, f.amount, f."companyAmount" AS company_amount, f.note, f."createdAt" AS created_at,
              pm.method AS payment_method, u.id AS master_id, u.username, u.surname
         FROM sale_master_fee f
         LEFT JOIN "user" u ON u.id = f."masterId"
         LEFT JOIN payment pm ON pm.id = f."paymentId"
        WHERE f."saleId" = $1 ORDER BY f.id`,
      [saleId],
    );
    const masterFees = rows.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      companyAmount: Number(row.company_amount),
      note: row.note,
      createdAt: row.created_at,
      // Savdodan keyin qo'shilganda kompaniya ulushi qanday to'langani (`null` — savdo bilan birga yoki qarzga).
      paymentMethod: row.payment_method,
      master: row.master_id ? { id: row.master_id, username: row.username, surname: row.surname } : null,
    }));
    return {
      masterFees,
      masterFeeTotal: masterFees.reduce((sum, fee) => sum + fee.amount, 0),
      masterFeeCompanyTotal: masterFees.reduce((sum, fee) => sum + fee.companyAmount, 0),
    };
  }

  /**
   * Ustalar ro'yxati (sahifalab, qidiruv bilan): har bir usta nechta savdoda qatnashgani, shu savdolarning
   * jami summasi (chegirmadan keyin), jami haqi (`amount`) va uning xizmatlaridan kompaniya ulushi (`companyAmount`).
   * `start`/`end` (YYYY-MM-DD) — savdo sanasi bo'yicha oraliq.
   * `totals` — qidiruv va oraliqqa mos hamma ustalar bo'yicha (sahifaga bog'liq emas).
   */
  async masterFeesSummary(page = 1, limit = 10, search?: string, start?: string, end?: string) {
    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 ? Math.min(limit, 100) : 10;
    const { where, params } = this.feeRange(start, end);
    const conditions = [where];
    const term = search?.trim();
    if (term) {
      params.push(`%${term}%`);
      conditions.push(
        `(u.username ILIKE $${params.length} OR u.surname ILIKE $${params.length}
          OR concat_ws(' ', u.username, u.surname) ILIKE $${params.length})`,
      );
    }
    const whereSql = conditions.join(' AND ');

    // Bir savdoda bir usta bir necha qator olishi mumkin: avval (usta, savdo) bo'yicha jamlanadi, savdo summasi ikki marta sanalmaydi.
    const base = `
      WITH per_sale AS (
        SELECT f."masterId" AS master_id, f."saleId" AS sale_id, sum(f.amount) AS fee, sum(f."companyAmount") AS company
          FROM sale_master_fee f
          JOIN sale s ON s.id = f."saleId"
          LEFT JOIN "user" u ON u.id = f."masterId"
         WHERE ${whereSql}
         GROUP BY f."masterId", f."saleId"
      )`;

    const [totals] = await this.saleRepository.query(
      `${base}
       SELECT count(DISTINCT p.master_id) AS masters, count(DISTINCT p.sale_id) AS sales,
              coalesce(sum(p.fee), 0) AS amount, coalesce(sum(p.company), 0) AS company
         FROM per_sale p`,
      params,
    );
    const rows: Record<string, unknown>[] = await this.saleRepository.query(
      `${base}
       SELECT u.id AS master_id, u.username, u.surname, u.phone,
              count(*) AS sales, sum(p.fee) AS amount, sum(p.company) AS company, sum(s.total - s.discount) AS sales_total
         FROM per_sale p
         JOIN sale s ON s.id = p.sale_id
         LEFT JOIN "user" u ON u.id = p.master_id
        GROUP BY u.id, u.username, u.surname, u.phone
        ORDER BY sum(p.fee) DESC, u.id
        LIMIT ${safeLimit} OFFSET ${(safePage - 1) * safeLimit}`,
      params,
    );

    const count = Number(totals.masters);
    return {
      meta: { total: count, page: safePage, limit: safeLimit, totalPages: Math.ceil(count / safeLimit) },
      data: rows.map((row) => ({
        masterId: row.master_id as number | null,
        username: row.username as string | null,
        surname: row.surname as string | null,
        phone: row.phone as string | null,
        sales: Number(row.sales),
        salesTotal: Number(row.sales_total),
        amount: Number(row.amount),
        companyAmount: Number(row.company),
      })),
      totals: {
        masters: count,
        sales: Number(totals.sales),
        amount: Number(totals.amount),
        companyAmount: Number(totals.company),
      },
    };
  }

  /**
   * Bitta usta: davr ichida nechta savdoda qatnashgani, savdolar summasi, haqi — va har bir savdo
   * (sana, kontragent, summa, haq, sotilgan mahsulotlar), sahifalab.
   */
  async masterFeeDetail(masterId: number, page = 1, limit = 10, start?: string, end?: string) {
    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 ? Math.min(limit, 100) : 10;

    const master = await this.saleRepository.manager.findOne(User, {
      where: { id: masterId },
      select: { id: true, username: true, surname: true, phone: true },
    });
    if (!master) throw new NotFoundException('Мастер не найден');

    const { where, params } = this.feeRange(start, end);
    params.push(masterId);
    const whereSql = `${where} AND f."masterId" = $${params.length}`;

    const perSale = `
      SELECT s.id AS sale_id, s.date, s.total, s.discount, sum(f.amount) AS fee, sum(f."companyAmount") AS company,
             string_agg(DISTINCT f.note, '; ') FILTER (WHERE f.note IS NOT NULL) AS note
        FROM sale_master_fee f JOIN sale s ON s.id = f."saleId"
       WHERE ${whereSql}
       GROUP BY s.id, s.date, s.total, s.discount`;

    const [totals] = await this.saleRepository.query(
      `SELECT count(*) AS sales, coalesce(sum(t.fee), 0) AS amount, coalesce(sum(t.company), 0) AS company,
              coalesce(sum(t.total - t.discount), 0) AS sales_total
         FROM (${perSale}) t`,
      params,
    );
    const sales: Record<string, unknown>[] = await this.saleRepository.query(
      `SELECT t.*, c.id AS customer_id, c.username AS customer_username, c.surname AS customer_surname, c."orgName" AS customer_org
         FROM (${perSale}) t
         JOIN sale s ON s.id = t.sale_id
         LEFT JOIN customer c ON c.id = s."customerId"
        ORDER BY t.date DESC, t.sale_id DESC
        LIMIT ${safeLimit} OFFSET ${(safePage - 1) * safeLimit}`,
      params,
    );

    const ids = sales.map((row) => row.sale_id as number);
    const items: { sale_id: number; name: string | null; quantity: string; price: number }[] = ids.length
      ? await this.saleRepository.query(
          `SELECT si."saleId" AS sale_id, p.name, si.quantity, si.price
             FROM sale_item si LEFT JOIN product p ON p.id = si."productId"
            WHERE si."saleId" = ANY($1::int[]) ORDER BY si.id`,
          [ids],
        )
      : [];

    const total = Number(totals.sales);
    return {
      master,
      totals: {
        sales: total,
        salesTotal: Number(totals.sales_total),
        amount: Number(totals.amount),
        companyAmount: Number(totals.company),
      },
      meta: { total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) },
      data: sales.map((row) => ({
        saleId: row.sale_id as number,
        date: row.date,
        saleTotal: Number(row.total) - Number(row.discount),
        amount: Number(row.fee),
        companyAmount: Number(row.company),
        note: (row.note as string | null) ?? null,
        customer: row.customer_id
          ? {
              id: row.customer_id,
              name: (row.customer_org as string | null)
                || `${row.customer_username ?? ''} ${row.customer_surname ?? ''}`.trim(),
            }
          : null,
        items: items
          .filter((item) => item.sale_id === row.sale_id)
          .map((item) => ({ name: item.name, quantity: Number(item.quantity), price: Number(item.price) })),
      })),
    };
  }

  /** Usta xizmatlari ro'yxati (qaysi savdoda, kimga, qancha) — sahifalab. `master_id` bilan bitta usta. */
  async masterFeesList(page: number, limit: number, masterId?: number, start?: string, end?: string) {
    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 ? Math.min(limit, 100) : 10;
    const { where, params } = this.feeRange(start, end);
    const conditions = [where];
    if (masterId) {
      params.push(masterId);
      conditions.push(`f."masterId" = $${params.length}`);
    }
    const whereSql = conditions.join(' AND ');

    const [{ total }] = await this.saleRepository.query(
      `SELECT count(*) AS total FROM sale_master_fee f JOIN sale s ON s.id = f."saleId" WHERE ${whereSql}`,
      params,
    );
    const rows: Record<string, unknown>[] = await this.saleRepository.query(
      `SELECT f.id, f.amount, f."companyAmount" AS company_amount, f.note, s.id AS sale_id, s.date AS sale_date,
              u.id AS master_id, u.username AS master_username, u.surname AS master_surname,
              c.id AS customer_id, c.username AS customer_username, c.surname AS customer_surname, c."orgName" AS customer_org
         FROM sale_master_fee f
         JOIN sale s ON s.id = f."saleId"
         LEFT JOIN "user" u ON u.id = f."masterId"
         LEFT JOIN customer c ON c.id = s."customerId"
        WHERE ${whereSql}
        ORDER BY f.id DESC
        LIMIT ${safeLimit} OFFSET ${(safePage - 1) * safeLimit}`,
      params,
    );

    return {
      meta: { total: Number(total), page: safePage, limit: safeLimit, totalPages: Math.ceil(Number(total) / safeLimit) },
      data: rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        companyAmount: Number(row.company_amount),
        note: row.note,
        saleId: row.sale_id,
        saleDate: row.sale_date,
        master: row.master_id
          ? { id: row.master_id, username: row.master_username, surname: row.master_surname }
          : null,
        customer: row.customer_id
          ? { id: row.customer_id, name: row.customer_org || `${row.customer_username ?? ''} ${row.customer_surname ?? ''}`.trim() }
          : null,
      })),
    };
  }

  private feeRange(start?: string, end?: string) {
    const params: unknown[] = [];
    const parts = ['true'];
    const date = /^\d{4}-\d{2}-\d{2}$/;
    if (start && date.test(start)) {
      params.push(start);
      parts.push(`s.date >= $${params.length}::date`);
    }
    if (end && date.test(end)) {
      params.push(end);
      parts.push(`s.date < ($${params.length}::date + interval '1 day')`);
    }
    return { where: parts.join(' AND '), params };
  }

  /**
   * Savdo qilingandan keyin kontragentni almashtirish (kassir adashib boshqasini tanlagan bo'lishi mumkin)
   * va/yoki savdoni "По договору" ga o'tkazish. Hammasi bitta tranzaksiyada, shuning uchun yarim holat qolmaydi.
   *
   * - Kontragent: savdo bilan birga shu savdodan qilingan qaytarishlar va bog'langan shartnoma (vazifalari bilan)
   *   ham yangi kontragentga o'tadi — qarz, aylanma va tarix bitta kontragentda qoladi.
   * - `by_contract`: shartnoma va kuzatuv vazifasi xuddi kassadagi "По договору" savdosidagidek ochiladi
   *   (javobgarsiz, "свободный" — buxgalter "Взять в работу" bosganda vazifa ham unga o'tadi). Qarz o'zgarmaydi:
   *   to'lovni buxgalter bank o'tkazmasi sifatida kiritadi. Faqat qarzi qolgan va shartnomasi yo'q savdo uchun.
   *
   * Yangilangan tafsilotni qaytaradi (ichida `contract`).
   */
  async changeCustomer(id: number, dto: ChangeSaleCustomerDto) {
    const wantsCustomer = dto.customer_id !== undefined && dto.customer_id !== null;
    if (!wantsCustomer && !dto.by_contract) {
      throw new BadRequestException('Укажите нового контрагента или оформите продажу по договору');
    }

    await this.saleRepository.manager.transaction(async (em) => {
      const sale = await em.findOne(Sale, { where: { id }, relations: { customer: true, payments: true } });
      if (!sale) throw new NotFoundException('Продажа не найдена');

      const actor = await em.findOneBy(User, { id: dto.user_id });
      if (!actor) throw new NotFoundException(`Пользователь #${dto.user_id} не найден`);

      let customer: Customer | null = null;
      if (wantsCustomer) {
        customer = await em.findOneBy(Customer, { id: dto.customer_id });
        if (!customer) throw new NotFoundException('Контрагент не найден');
      }

      const customerChanges = Boolean(customer) && sale.customer?.id !== customer!.id;
      if (!customerChanges && !dto.by_contract) {
        throw new BadRequestException('Этот контрагент уже указан в продаже');
      }

      if (customerChanges) {
        // Balans mijozga bog'liq: eski mijoz balansidan to'langan qism bekor qilinadi (pul unga qaytadi, savdoda qarz
        // qoladi), shu savdodan qaytarishlar balansga yozilgan bo'lsa — yangi kontragentga o'tadi.
        await this.balanceService.followSaleCustomer(em, id, sale.customer?.id ?? null, customer!.id);
        await em.update(Sale, { id }, { customer: { id: customer!.id } as Customer });
        await em.createQueryBuilder()
          .update(Return)
          .set({ customer: { id: customer!.id } as Customer })
          .where('"saleId" = :id', { id })
          .execute();
        await this.contractService.followSaleCustomer(em, id, customer!, actor);
      }

      if (dto.by_contract) {
        if (await em.exists(Contract, { where: { sale: { id } } })) {
          throw new BadRequestException('По этой продаже уже есть договор');
        }
        // Kontragent almashgan bo'lsa "С баланса" to'lovlari yuqorida bekor qilindi — ular hisobga olinmaydi.
        const paid = sale.payments
          .filter((payment) => !(customerChanges && payment.method.trim() === BALANCE_PAY_METHOD))
          .reduce((sum, payment) => sum + payment.amount, 0);
        if (Math.max(0, sale.total - sale.discount - paid) <= 0) {
          throw new BadRequestException('Продажа полностью оплачена — оформить её по договору нельзя');
        }

        // Belgi: to'lovlar ro'yxatida "По договору" ko'rinadi (summa 0 — qarz o'zgarmaydi).
        if (!sale.payments.some((payment) => payment.method.trim() === CONTRACT_METHOD)) {
          await em.save(em.create(Payment, { sale: { id } as Sale, method: CONTRACT_METHOD, amount: 0 }));
        }
        await this.contractService.openForSale(em, id, true);
      }
    });

    return this.findDetail(id);
  }

  /**
   * Qarzni aniq tovarlar bo'yicha to'lash: "310 metrdan 10 metri uchun". Har bir qatordan ko'pi bilan to'lanmagan
   * qismi (sotilgan − qaytarilgan − avval shu qator uchun to'langan). Summa — savdodagi narx, savdo chegirmasi
   * mutanosib (qaytarishdagi qoida bilan bir xil), ko'pi bilan qolgan qarz. To'lov pul bilan (odatiy "В долг" usuli)
   * yoki kontragent balansidan ("С баланса"). To'lov va qatorlarga bo'linishi bitta tranzaksiyada.
   * Yangilangan tafsilotni qaytaradi.
   */
  async payItems(id: number, dto: PaySaleItemsDto) {
    const method = dto.method?.trim() || DEBT_METHOD;
    if (!dto.from_balance && (method === CONTRACT_METHOD || isNonCashMethod(method))) {
      throw new BadRequestException('Этот способ оплаты нельзя выбрать для оплаты долга');
    }

    await this.saleRepository.manager.transaction(async (em) => {
      // Bir vaqtda ikki to'lov bitta qatorni ortiqcha to'lab yubormasligi uchun savdo qulflanadi.
      const locked: unknown[] = await em.query('SELECT id FROM sale WHERE id = $1 FOR UPDATE', [id]);
      if (locked.length === 0) throw new NotFoundException('Продажа не найдена');
      const sale = await em.findOne(Sale, {
        where: { id },
        relations: { items: { product: true, returnItems: true, paymentAllocations: true }, payments: true, customer: true },
      });
      if (!sale) throw new NotFoundException('Продажа не найдена');

      const requested = new Map<number, number>();
      for (const item of dto.items) {
        if (roundQuantity(item.quantity) !== item.quantity) throw new BadRequestException('Неверное количество');
        requested.set(item.sale_item_id, roundQuantity((requested.get(item.sale_item_id) ?? 0) + item.quantity));
      }

      const lines: { saleItem: SaleItem; quantity: number; gross: number }[] = [];
      for (const [saleItemId, quantity] of requested) {
        const saleItem = sale.items.find((item) => item.id === saleItemId);
        if (!saleItem) throw new BadRequestException('Товар не найден в этой продаже');
        const returned = saleItem.returnItems.reduce((sum, r) => sum + r.quantity, 0);
        const paid = saleItem.paymentAllocations.reduce((sum, a) => sum + a.quantity, 0);
        const unpaid = Math.max(0, roundQuantity(saleItem.quantity - returned - paid));
        if (quantity > unpaid) {
          throw new BadRequestException(`«${saleItem.product?.name ?? `#${saleItem.id}`}»: не оплачено только ${unpaid}`);
        }
        lines.push({ saleItem, quantity, gross: quantity * saleItem.price });
      }

      const net = sale.total - sale.discount;
      const debt = Math.max(0, net - sale.payments.reduce((sum, payment) => sum + payment.amount, 0));
      if (debt <= 0) throw new BadRequestException('По этой продаже долга нет');

      const gross = lines.reduce((sum, line) => sum + line.gross, 0);
      const value = sale.total > 0 ? Math.round(gross * net / sale.total) : 0;
      // Avval umumiy qarzdan to'langan bo'lsa, tovarlar summasi qolgan qarzdan oshishi mumkin — qarzgacha.
      const amount = Math.min(value, debt);
      if (amount <= 0) throw new BadRequestException('Сумма за выбранные товары равна нулю');

      let payment: Payment;
      if (dto.from_balance) {
        if (!sale.customer) throw new BadRequestException('В продаже нет контрагента — оплатить с баланса нельзя');
        payment = await this.balanceService.spendOnSale(em, {
          customerId: sale.customer.id,
          saleId: id,
          amount,
          userId: dto.user_id,
        });
      } else {
        payment = await em.save(em.create(Payment, { sale: { id } as Sale, amount, method }));
      }

      // Summa qatorlarga ulushiga qarab bo'linadi; yaxlitlash qoldig'i oxirgi qatorga.
      let left = amount;
      for (const [index, line] of lines.entries()) {
        const part = index === lines.length - 1 ? left : Math.round(line.gross * amount / gross);
        left -= part;
        await em.save(em.create(SalePaymentItem, {
          payment: { id: payment.id } as Payment,
          saleItem: { id: line.saleItem.id } as SaleItem,
          quantity: line.quantity,
          amount: part,
        }));
      }
    });

    return this.findDetail(id);
  }

  /**
   * Savdo qilingandan keyin usta xizmatini qo'shish (usta kech kelgan bo'lsa). Hisob kassadagidek: ustaning ulushi
   * savdo summasiga kirmaydi, kompaniya ulushi `sale.total` ga qo'shiladi. Ulush shu zahoti to'langan bo'lsa
   * (`method`), to'lov yoziladi va xizmatga bog'lanadi; "В долг" (yoki usul berilmasa) — savdo qarziga qo'shiladi.
   * Savdoning shartnomasi bo'lsa, uning summasi ham yangilanadi (yopilgan shartnomada rad etiladi).
   * Hammasi bitta tranzaksiyada. Yangilangan tafsilotni qaytaradi.
   */
  async addMasterFee(id: number, dto: AddSaleMasterFeeDto) {
    const [fee] = await this.normalizeMasterFees([
      { master_id: dto.master_id, amount: dto.amount, company_amount: dto.company_amount, note: dto.note },
    ]);
    const method = dto.method?.trim() || DEBT_METHOD;
    if (method === CONTRACT_METHOD || isNonCashMethod(method)) {
      throw new BadRequestException('Этот способ оплаты нельзя выбрать для услуги мастера');
    }

    let feeId = 0;
    let actor: User | null = null;
    await this.saleRepository.manager.transaction(async (em) => {
      if (!(await em.exists(Sale, { where: { id } }))) throw new NotFoundException('Продажа не найдена');
      actor = await em.findOneBy(User, { id: dto.user_id });
      if (!actor) throw new NotFoundException(`Пользователь #${dto.user_id} не найден`);
      if ((await em.count(SaleMasterFee, { where: { sale: { id } } })) >= MAX_MASTER_FEES) {
        throw new BadRequestException(`Услуг мастеров в одной продаже не больше ${MAX_MASTER_FEES}`);
      }

      let payment: Payment | null = null;
      if (fee.companyAmount > 0) {
        await em.increment(Sale, { id }, 'total', fee.companyAmount);
        await this.contractService.followSaleTotal(em, id, actor, `добавлена услуга мастера: +${fee.companyAmount.toLocaleString('ru-RU')}`);
        if (method !== DEBT_METHOD) {
          payment = await em.save(em.create(Payment, { sale: { id } as Sale, amount: fee.companyAmount, method }));
        }
      }

      const saved = await em.save(em.create(SaleMasterFee, {
        sale: { id } as Sale,
        master: { id: fee.masterId } as User,
        amount: fee.amount,
        companyAmount: fee.companyAmount,
        note: fee.note,
        payment,
      }));
      feeId = saved.id;
    });

    // Telegram ga (javobni kutmasdan): savdo summasi va kassa o'zgargan bo'lishi mumkin.
    this.telegramBot.notifyMasterFee(feeId, actor);
    return this.findDetail(id);
  }

  /**
   * Usta xizmatini o'chirish (faqat admin; adashib qo'shilgan bo'lsa). Kompaniya ulushi savdo summasidan ayiriladi;
   * ulush savdodan keyin alohida to'langan bo'lsa, o'sha to'lov ham o'chadi. Ulush savdo bilan birga to'langan
   * bo'lsa va o'chirilsa to'lov savdo summasidan oshib ketsa — rad etiladi (pulni qaytarishning boshqa yo'li yo'q).
   */
  async removeMasterFee(feeId: number, userId: number) {
    let saleId = 0;
    await this.saleRepository.manager.transaction(async (em) => {
      const actor = userId ? await em.findOneBy(User, { id: userId }) : null;
      if (actor?.role?.trim().toLowerCase() !== 'admin') {
        throw new ForbiddenException('Удалять услугу мастера может только администратор');
      }

      const fee = await em.findOne(SaleMasterFee, { where: { id: feeId }, relations: { sale: true, payment: true } });
      if (!fee) throw new NotFoundException('Услуга мастера не найдена');
      saleId = fee.sale.id;

      if (fee.companyAmount > 0) {
        const sale = await em.findOne(Sale, { where: { id: saleId }, relations: { payments: true, returns: true } });
        if (!sale) throw new NotFoundException('Продажа не найдена');
        const net = sale.total - fee.companyAmount - sale.discount;
        const paid = sale.payments
          .filter((payment) => payment.id !== fee.payment?.id)
          .reduce((sum, payment) => sum + payment.amount, 0);
        const returned = sale.returns.reduce((sum, item) => sum + item.total - item.discount, 0);
        if (paid > net || returned > net) {
          throw new BadRequestException(
            'Доля компании уже оплачена вместе с продажей — после удаления оплата станет больше суммы продажи. Удалить нельзя',
          );
        }

        if (fee.payment) await em.delete(Payment, { id: fee.payment.id });
        await em.decrement(Sale, { id: saleId }, 'total', fee.companyAmount);
        await this.contractService.followSaleTotal(em, saleId, actor, `удалена услуга мастера: −${fee.companyAmount.toLocaleString('ru-RU')}`);
      }

      await em.delete(SaleMasterFee, { id: feeId });
    });

    return this.findDetail(saleId);
  }

  // async update(id: number, updateSaleDto: UpdateSaleDto) {

  //   const checkSale = await this.saleRepository.findOneBy({ id });
  //   if (!checkSale) throw new NotFoundException("Не найден Прдоажа");

  //   const { items, payments, ...saleData } = updateSaleDto;

  //   const sale = await this.saleRepository.preload({
  //     id,
  //     ...saleData
  //   });

  //   if (!sale) throw new NotFoundException();

  //   await this.saleRepository.save(sale);

  //   return sale;
  // }

  async remove(id: number) {
    const checkSale = await this.saleRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Прдоажа");
    await this.saleRepository.remove(checkSale)
    return { message: "Продажа удален" }

  }
}
