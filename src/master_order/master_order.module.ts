import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from 'src/category/entities/category.entity';
import { Product } from 'src/product/entities/product.entity';
import { Sale } from 'src/sale/entities/sale.entity';
import { Stock } from 'src/stock/entities/stock.entity';
import { User } from 'src/user/entities/user.entity';
import { MasterOrder } from './entities/master-order.entity';
import { MasterOrderItem } from './entities/master-order-item.entity';
import { MasterOrderController } from './master_order.controller';
import { MasterOrderService } from './master_order.service';

@Module({
  imports: [TypeOrmModule.forFeature([MasterOrder, MasterOrderItem, Product, Category, Stock, User, Sale])],
  controllers: [MasterOrderController],
  providers: [MasterOrderService],
})
export class MasterOrderModule {}
