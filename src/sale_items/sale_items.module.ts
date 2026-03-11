import { Module } from '@nestjs/common';
import { SaleItemsService } from './sale_items.service';
import { SaleItemsController } from './sale_items.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleItem } from './entities/sale_item.entity';

@Module({
  imports:[TypeOrmModule.forFeature([SaleItem])],
  controllers: [SaleItemsController],
  providers: [SaleItemsService],
  exports:[SaleItemsService]
})
export class SaleItemsModule {}
