import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItemsService } from 'src/purchase_items/purchase_items.service';
import { Repository } from 'typeorm';
import { PaymentService } from 'src/payment/payment.service';
import { StockService } from 'src/stock/stock.service';
import { UpdateSaleDto } from 'src/sale/dto/update-sale.dto';

@Injectable()
export class PurchaseService {
   constructor(
      @InjectRepository(Purchase)
      private readonly purchaseRepository: Repository<Purchase>,
      private readonly purchaseItemsService: PurchaseItemsService,
      private readonly paymentService: PaymentService,
      private readonly stockService: StockService
  
    ) { }
  
  
    async createFullPurchase(createPurchaseDto: CreatePurchaseDto) {
  
      let total = 0;
  
      for (const item of createPurchaseDto.items) {
        total += item.quantity * item.price;
      }
  
      const purchase = this.purchaseRepository.create({
        customer: { id: createPurchaseDto.customer_id },
        user: { id: createPurchaseDto.user_id },
        total
      });
  
      await this.purchaseRepository.save(purchase);
  
      for (const item of createPurchaseDto.items) {
        await this.purchaseItemsService.create({
          ...item,
          purchase_id: purchase.id
        });
      }
  
      for (const payment of createPurchaseDto.payments) {
        await this.paymentService.createPurchase({
          ...payment,
          purchase_id: purchase.id
        });
      }
  
  
      for(const item of createPurchaseDto.items){
        await this.stockService.updateFilterAdd(item)
      }
  
  
      return this.purchaseRepository.findOne({
        where: { id: purchase.id },
        relations: ['items', 'payments']
      });
    }
  
  
  
  
    async findAll() {
  
      return this.purchaseRepository.find();//{ relations: ["items", "payments", "items.product", "customer", "user"] }
    }
  
  
    async findAllPag(page: number, limit: number) {
  
      page = page > 0 ? page : 1;
      limit = limit > 0 ? limit : 10;
  
      const skip = (page - 1) * limit;
  
      const [data, total] = await this.purchaseRepository.findAndCount({
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

        const query = this.purchaseRepository.createQueryBuilder('purchase')
        .leftJoinAndSelect('purchase.items', 'items')
        .leftJoinAndSelect('purchase.payments', 'payments')
        .leftJoinAndSelect('purchase.user', 'user')
        .leftJoinAndSelect('items.warehouse', 'warehouse')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('purchase.customer', 'customer');

        // 🔍 Search qo‘shish new added
        if (search) {
          query.where(
            'user.username LIKE :search OR customer.username LIKE :search',
            { search: `%${search}%`}
          );
        }

        const [data, total] = await query
          .orderBy('purchase.id', 'DESC')
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
  
      const checkSale = await this.purchaseRepository.findOneBy({ id });
      if (!checkSale) throw new NotFoundException("Не найден Приход");
  
      return checkSale;
    }
  
    async update(id: number, updateSaleDto: UpdateSaleDto) {
  
      const checkSale = await this.purchaseRepository.findOneBy({ id });
      if (!checkSale) throw new NotFoundException("Не найден Прдоажа");
  
      const { items, payments, ...saleData } = updateSaleDto;
  
      const sale = await this.purchaseRepository.preload({
        id,
        ...saleData
      });
  
      if (!sale) throw new NotFoundException();
  
      await this.purchaseRepository.save(sale);
  
      return sale;
    }
  
    async remove(id: number) {
      const checkSale = await this.purchaseRepository.findOneBy({ id });
      if (!checkSale) throw new NotFoundException("Не найден Прдоажа");
      await this.purchaseRepository.remove(checkSale)
      return { message: "Продажа удален" }
  
    }
}
