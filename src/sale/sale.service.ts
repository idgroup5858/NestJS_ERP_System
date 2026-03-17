import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Sale } from './entities/sale.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaleItemsService } from 'src/sale_items/sale_items.service';
import { PaymentService } from 'src/payment/payment.service';
import { StockService } from 'src/stock/stock.service';

@Injectable()
export class SaleService {

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    private readonly saleItemsService: SaleItemsService,
    private readonly paymentService: PaymentService,
    private readonly stockService: StockService

  ) { }


  async createFullSale(createSaleDto: CreateSaleDto) {

    let total = 0;

    for (const item of createSaleDto.items) {
      total += item.quantity * item.price;
    }

    const sale = this.saleRepository.create({
      customer: { id: createSaleDto.customer_id },
      user: { id: createSaleDto.user_id },
      total
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


    return this.saleRepository.findOne({
      where: { id: sale.id },
      relations: ['items', 'payments']
    });
  }




  async findAll() {

    return this.saleRepository.find();//{ relations: ["items", "payments", "items.product", "customer", "user"] }
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


  async findOne(id: number) {

    const checkSale = await this.saleRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Прдоажа");

    return checkSale;
  }

  async update(id: number, updateSaleDto: UpdateSaleDto) {

    const checkSale = await this.saleRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Прдоажа");

    const { items, payments, ...saleData } = updateSaleDto;

    const sale = await this.saleRepository.preload({
      id,
      ...saleData
    });

    if (!sale) throw new NotFoundException();

    await this.saleRepository.save(sale);

    return sale;
  }

  async remove(id: number) {
    const checkSale = await this.saleRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Прдоажа");
    await this.saleRepository.remove(checkSale)
    return { message: "Продажа удален" }

  }
}
