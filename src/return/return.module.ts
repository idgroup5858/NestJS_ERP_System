import { Module } from '@nestjs/common';
import { ReturnService } from './return.service';
import { ReturnController } from './return.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Return } from './entities/return.entity';
import { ReturnItemsModule } from 'src/return_items/return_items.module';
import { PaymentModule } from 'src/payment/payment.module';
import { StockModule } from 'src/stock/stock.module';

@Module({
  imports:[ReturnItemsModule,PaymentModule,StockModule,TypeOrmModule.forFeature([Return])],
  controllers: [ReturnController],
  providers: [ReturnService],
})
export class ReturnModule {}
