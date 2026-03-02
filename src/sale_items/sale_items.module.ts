import { Module } from '@nestjs/common';
import { SaleItemsService } from './sale_items.service';
import { SaleItemsController } from './sale_items.controller';

@Module({
  controllers: [SaleItemsController],
  providers: [SaleItemsService],
})
export class SaleItemsModule {}
