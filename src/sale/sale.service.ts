import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Sale } from './entities/sale.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SaleItemsService } from 'src/sale_items/sale_items.service';
import { PaymentService } from 'src/payment/payment.service';
import { StockService } from 'src/stock/stock.service';
import { TelegramBotService } from 'src/telegram/telegram-bot.service';

/** Savdoda chegirma umumiy summaning shu foizidan oshmasligi kerak. */
const MAX_SALE_DISCOUNT_PERCENT = 20;

@Injectable()
export class SaleService {

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    private readonly saleItemsService: SaleItemsService,
    private readonly paymentService: PaymentService,
    private readonly stockService: StockService,
    private readonly telegramBot: TelegramBotService

  ) { }


  async createFullSale(createSaleDto: CreateSaleDto) {

    let total:number = 0;

    for (const item of createSaleDto.items) {
      total += item.quantity * item.price;
    }

    const discount = Math.round(Number(createSaleDto.discount) || 0);
    if (discount < 0 || discount > Math.floor(total * MAX_SALE_DISCOUNT_PERCENT / 100)) {
      throw new BadRequestException(`Скидка не может превышать ${MAX_SALE_DISCOUNT_PERCENT}% суммы продажи`);
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

    for (const item of createSaleDto.items) {
      await this.saleItemsService.create({
        ...item,
        sale_id: sale.id
      });
    }

    for (const payment of createSaleDto.payments) {
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

    return this.saleRepository.findOne({
      where: { id: sale.id },
      relations: ['items', 'payments']
    });
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



async findAllPagSearch(page: number, limit: number, search?: string) {
  page = page > 0 ? page : 1;
  limit = limit > 0 ? limit : 10;

  const skip = (page - 1) * limit;

  const query = this.saleRepository.createQueryBuilder('sale')
  .leftJoinAndSelect('sale.items', 'items')
  .leftJoinAndSelect('sale.payments', 'payments')
  .leftJoinAndSelect('sale.user', 'user')
  .leftJoinAndSelect('items.warehouse', 'warehouse')
  .leftJoinAndSelect('items.product', 'product')
  .leftJoinAndSelect('sale.customer', 'customer');

  // 🔍 Search qo‘shish
  if (search) {
    query.where(
      'user.username ILIKE :search OR customer.username ILIKE :search',
      { search: `%${search}%`}
    );
  }

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
      relations: ["items", "items.product", "items.warehouse", "items.returnItems", "payments", "customer", "user", "returns"],
      order: { items: { id: "ASC" }, payments: { id: "ASC" } }
    });
    if (!sale) throw new NotFoundException("Не найден Прдоажа");

    const { items, returns, ...rest } = sale;

    return {
      ...rest,
      items: items.map(({ returnItems, ...item }) => ({
        ...item,
        returned: returnItems.reduce((sum, r) => sum + r.quantity, 0)
      })),
      returnedTotal: returns.reduce((sum, r) => sum + r.total - r.discount, 0)
    };
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
