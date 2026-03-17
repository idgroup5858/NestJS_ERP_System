import { Module } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';
import { PurchaseItem } from 'src/purchase_items/entities/purchase_item.entity';
import { PaymentModule } from 'src/payment/payment.module';
import { StockModule } from 'src/stock/stock.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItemsModule } from 'src/purchase_items/purchase_items.module';

@Module({
  imports:[PurchaseItemsModule,PaymentModule,StockModule,TypeOrmModule.forFeature([Purchase])],
  controllers: [PurchaseController],
  providers: [PurchaseService],
})
export class PurchaseModule {}
