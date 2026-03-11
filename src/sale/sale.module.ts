import { Module } from '@nestjs/common';
import { SaleService } from './sale.service';
import { SaleController } from './sale.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItemsModule } from 'src/sale_items/sale_items.module';
import { PaymentModule } from 'src/payment/payment.module';

@Module({
  imports:[SaleItemsModule,PaymentModule,TypeOrmModule.forFeature([Sale])],
  controllers: [SaleController],
  providers: [SaleService],
})
export class SaleModule {}
