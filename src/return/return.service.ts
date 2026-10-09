import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnFromSaleDto } from './dto/return-from-sale.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { UpdateSaleDto } from 'src/sale/dto/update-sale.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Return } from './entities/return.entity';
import { ReturnItem } from 'src/return_items/entities/return_item.entity';
import { Sale } from 'src/sale/entities/sale.entity';
import { SaleItem } from 'src/sale_items/entities/sale_item.entity';
import { Payment } from 'src/payment/entities/payment.entity';
import { OFFSET_METHOD } from 'src/payment/payment-methods';
import { Stock } from 'src/stock/entities/stock.entity';
import { ReturnItemsService } from 'src/return_items/return_items.service';
import { PaymentService } from 'src/payment/payment.service';
import { StockService } from 'src/stock/stock.service';
import { TelegramBotService } from 'src/telegram/telegram-bot.service';
import { Repository } from 'typeorm';
import { roundMoney, roundQuantity } from 'src/common/quantity';

@Injectable()
export class ReturnService {
  constructor(
    @InjectRepository(Return)
    private readonly returnRepository: Repository<Return>,
    private readonly returnItemsService: ReturnItemsService,
    private readonly paymentService: PaymentService,
    private readonly stockService: StockService,
    private readonly telegramBot: TelegramBotService

  ) { }


  /**
   * Список продаж ichidan, aniq savdo qatorlari boʻyicha qaytarish.
   *
   * - Har bir qatordan sotilganidan (oldingi qaytarishlarni ayirib) koʻp qaytarib boʻlmaydi.
   * - Narx — savdodagi narx; savdo chegirmasi mutanosib taqsimlanadi.
   * - Savdoda qarz qolgan boʻlsa, summa avval qarzdan ayiriladi, qolgani
   *   mijozga `method` usulida qaytariladi.
   *
   * Qaytarish, tovarning omborga qaytishi va toʻlovlar bitta tranzaksiyada
   * yoziladi — yarim-yozilgan qaytarish qolmaydi.
   */
  async createFromSale(dto: ReturnFromSaleDto) {

    const result = await this.returnRepository.manager.transaction(async manager => {

      const sale = await manager.findOne(Sale, {
        where: { id: dto.sale_id },
        relations: ['items', 'items.product', 'items.warehouse', 'items.returnItems', 'payments', 'customer', 'returns'],
      });
      if (!sale) throw new NotFoundException('Продажа не найдена');

      const requested = new Map<number, number>();
      for (const item of dto.items) {
        if (roundQuantity(item.quantity) !== item.quantity) throw new BadRequestException('Неверное количество');
        requested.set(item.sale_item_id, roundQuantity((requested.get(item.sale_item_id) ?? 0) + item.quantity));
      }

      const lines: { saleItem: SaleItem, quantity: number }[] = [];
      for (const [saleItemId, quantity] of requested) {
        const saleItem = sale.items.find(item => item.id === saleItemId);
        if (!saleItem) throw new BadRequestException('Товар не найден в этой продаже');
        if (!saleItem.product || !saleItem.warehouse) {
          throw new BadRequestException('Товар или склад удалён — вернуть нельзя');
        }

        const available = roundQuantity(saleItem.quantity - saleItem.returnItems.reduce((sum, r) => sum + r.quantity, 0));
        if (quantity > available) {
          throw new BadRequestException(`«${saleItem.product.name}»: можно вернуть не больше ${available} шт.`);
        }
        lines.push({ saleItem, quantity });
      }

      const gross = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.saleItem.price, 0));
      const saleNet = sale.total - sale.discount;
      const returnedBefore = sale.returns.reduce((sum, r) => sum + r.total - r.discount, 0);

      // Yaxlitlash tufayli bir necha qismli qaytarish jami savdo summasidan oshib ketmasin.
      const proportional = sale.total > 0 ? Math.round(gross * saleNet / sale.total) : 0;
      const value = Math.max(0, Math.min(proportional, saleNet - returnedBefore));

      const paid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      const offset = Math.min(value, Math.max(0, saleNet - paid));
      const refund = value - offset;

      const method = dto.method?.trim();
      if (refund > 0 && !method) throw new BadRequestException('Выберите способ возврата денег');

      const returns = await manager.save(manager.create(Return, {
        customer: sale.customer ? { id: sale.customer.id } : undefined,
        user: dto.user_id ? { id: dto.user_id } : undefined,
        sale: { id: sale.id },
        total: gross,
        discount: gross - value,
      }));

      for (const { saleItem, quantity } of lines) {
        await manager.save(manager.create(ReturnItem, {
          returns: { id: returns.id },
          saleItem: { id: saleItem.id },
          product: { id: saleItem.product.id },
          warehouse: { id: saleItem.warehouse.id },
          quantity,
          price: saleItem.price,
          checkPrice: saleItem.checkPrice,
        }));

        const stock = await manager.findOne(Stock, {
          where: { product: { id: saleItem.product.id }, warehouse: { id: saleItem.warehouse.id } },
        });
        if (stock) {
          stock.quantity = roundQuantity(stock.quantity + quantity);
          await manager.save(stock);
        } else {
          await manager.save(manager.create(Stock, {
            quantity,
            product: { id: saleItem.product.id },
            warehouse: { id: saleItem.warehouse.id },
          }));
        }
      }

      if (refund > 0) {
        await manager.save(manager.create(Payment, { returns: { id: returns.id }, amount: refund, method }));
      }
      if (offset > 0) {
        await manager.save(manager.create(Payment, { returns: { id: returns.id }, amount: offset, method: OFFSET_METHOD }));
        await manager.save(manager.create(Payment, { sale: { id: sale.id }, amount: offset, method: OFFSET_METHOD }));
      }

      return { id: returns.id, total: gross, value, offset, refund };
    });

    // Tranzaksiya yakunlangach — Telegram ga (javobni kutmasdan).
    this.telegramBot.notifyReturn(result.id);

    return result;
  }


  async createFullReturns(createReturnsDto: CreateReturnDto) {

    let total = 0;

    for (const item of createReturnsDto.items) {
      total += item.quantity * item.price;
    }
    total = roundMoney(total);

    await this.stockService.assertAvailable(createReturnsDto.items, false);

    const returns = this.returnRepository.create({
      customer: createReturnsDto.customer_id ? { id: createReturnsDto.customer_id } : undefined,
      user: { id: createReturnsDto.user_id },
      total,
      discount: Math.round(Number(createReturnsDto.discount) || 0)
    });

    await this.returnRepository.save(returns);

    for (const item of createReturnsDto.items) {
      await this.returnItemsService.create({
        ...item,
        return_id: returns.id
      });
    }

    for (const payment of createReturnsDto.payments) {
      await this.paymentService.createReturn({
        ...payment,
        return_id: returns.id
      });
    }


    for (const item of createReturnsDto.items) {
      await this.stockService.updateFilterAdd(item)
    }

    this.telegramBot.notifyReturn(returns.id);

    return this.returnRepository.findOne({
      where: { id: returns.id },
      //relations: ['items', 'payments']
    });
  }




  async findAll() {

    return this.returnRepository.find(
      { relations: ["items", "payments", "items.product", "customer", "user"] }
    );//{ relations: ["items", "payments", "items.product", "customer", "user"] }
  }


  async findAllPag(page: number, limit: number) {

    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.returnRepository.findAndCount({
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

        const query = this.returnRepository.createQueryBuilder('return')
        .leftJoinAndSelect('return.items', 'items')
        .leftJoinAndSelect('return.payments', 'payments')
        .leftJoinAndSelect('return.user', 'user')
        .leftJoinAndSelect('items.warehouse', 'warehouse')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('return.customer', 'customer')
        .leftJoinAndSelect('return.sale', 'sale');

        // 🔍 Search qo‘shish new added
        if (search) {
          query.where(
            'user.username ILIKE :search OR customer.username ILIKE :search',
            { search: `%${search}%`}
          );
        }

        const [data, total] = await query
          .orderBy('return.id', 'DESC')
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

    const checkSale = await this.returnRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Прдоажа");

    return checkSale;
  }

  async update(id: number, updateSaleDto: UpdateSaleDto) {

    const checkSale = await this.returnRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Прдоажа");

    const { items, payments, ...saleData } = updateSaleDto;

    const sale = await this.returnRepository.preload({
      id,
      ...saleData
    });

    if (!sale) throw new NotFoundException();

    await this.returnRepository.save(sale);

    return sale;
  }

  async remove(id: number) {
    const checkSale = await this.returnRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Прдоажа");
    await this.returnRepository.remove(checkSale)
    return { message: "Продажа удален" }

  }
}
