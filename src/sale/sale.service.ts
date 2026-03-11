import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Sale } from './entities/sale.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaleItemsService } from 'src/sale_items/sale_items.service';
import { PaymentService } from 'src/payment/payment.service';

@Injectable()
export class SaleService {

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    private readonly saleItemsService: SaleItemsService,
    private readonly paymentService: PaymentService
    
  ) { }


async createFullSale(createSaleDto: CreateSaleDto) {

  let total = 0;

  for (const item of createSaleDto.items) {
    total += item.quantity * item.price;
  }

  const sale = this.saleRepository.create({
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

     //return this.findOne(sale.id);
      return this.saleRepository.findOne({
        where: { id: sale.id },
        relations: ['items', 'payments']
    });
}


//   async createFullSale(createSaleDto: CreateSaleDto) {
//     // 1. Sale yaratish
//     const sale = this.saleRepository.create({
//         ...createSaleDto,
//         items: [],      // bo‘sh array boshlash
//         payments: []
//     });
//     await this.saleRepository.save(sale);

//     // 2. Sale items yaratish
//     for (const itemDto of createSaleDto.items) {
//         await this.saleItemsService.create({
//             ...itemDto,
//             sale_id: sale.id
//         });
//     }

//     // 3. Payments yaratish
//     for (const paymentDto of createSaleDto.payments) {
//         await this.paymentService.create({
//             ...paymentDto,
//             sale_id: sale.id
//         });
//     }

//     // 4. Yakuniy sale ni qaytarish
//     return this.saleRepository.findOne({
//         where: { id: sale.id },
//         relations: ['items', 'payments']
//     });
// }


  async findAll() {

    return this.saleRepository.find({relations:["items","payments","items.product"]});
  }


  async findAllPag(page: number, limit: number) {

    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.saleRepository.findAndCount({
      skip,
      take: limit,
      order: { id: 'DESC' }, // ixtiyoriy
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
    if (!checkSale) throw new NotFoundException("Не найден Продукт");

    return checkSale;
  }

  async update(id: number, updateSaleDto: UpdateSaleDto) {

  const checkSale = await this.saleRepository.findOneBy({ id });
  if (!checkSale) throw new NotFoundException("Sale topilmadi");

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
    if (!checkSale) throw new NotFoundException("Не найден Продукт");
    await this.saleRepository.remove(checkSale)
    return { message: "Продукт удален" }

  }
}
