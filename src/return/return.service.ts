import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { UpdateSaleDto } from 'src/sale/dto/update-sale.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Return } from './entities/return.entity';
import { ReturnItemsService } from 'src/return_items/return_items.service';
import { PaymentService } from 'src/payment/payment.service';
import { StockService } from 'src/stock/stock.service';
import { Repository } from 'typeorm';

@Injectable()
export class ReturnService {
  constructor(
    @InjectRepository(Return)
    private readonly returnRepository: Repository<Return>,
    private readonly returnItemsService: ReturnItemsService,
    private readonly paymentService: PaymentService,
    private readonly stockService: StockService

  ) { }


  async createFullReturns(createReturnsDto: CreateReturnDto) {

    let total = 0;

    for (const item of createReturnsDto.items) {
      total += item.quantity * item.price;
    }

    const returns = this.returnRepository.create({
      customer: { id: createReturnsDto.customer_id },
      user: { id: createReturnsDto.user_id },
      total,
      discount:createReturnsDto.discount
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
        .leftJoinAndSelect('return.customer', 'customer');

        // 🔍 Search qo‘shish new added
        if (search) {
          query.where(
            'user.username LIKE :search OR customer.username LIKE :search',
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
