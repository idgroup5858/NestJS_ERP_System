import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from './entities/stock.entity';
import { ProductModule } from 'src/product/product.module';
import { WarehouseModule } from 'src/warehouse/warehouse.module';

@Module({
  imports:[TypeOrmModule.forFeature([Stock]),ProductModule,WarehouseModule],
  controllers: [StockController],
  providers: [StockService],
  exports:[StockService]
})
export class StockModule {}
