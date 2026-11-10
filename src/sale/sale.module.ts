import { Module } from '@nestjs/common';
import { SaleService } from './sale.service';
import { SaleController } from './sale.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from './entities/sale.entity';
import { SaleMasterFee } from './entities/sale-master-fee.entity';
import { SalePaymentItem } from './entities/sale-payment-item.entity';
import { SaleItemsModule } from 'src/sale_items/sale_items.module';
import { PaymentModule } from 'src/payment/payment.module';
import { StockModule } from 'src/stock/stock.module';
import { TelegramModule } from 'src/telegram/telegram.module';
import { ContractModule } from 'src/contract/contract.module';
import { CustomerModule } from 'src/customer/customer.module';

@Module({
  imports:[SaleItemsModule,PaymentModule,StockModule,TelegramModule,ContractModule,CustomerModule,TypeOrmModule.forFeature([Sale, SaleMasterFee, SalePaymentItem])],
  controllers: [SaleController],
  providers: [SaleService],
})
export class SaleModule {}
