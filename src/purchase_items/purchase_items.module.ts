import { Module } from '@nestjs/common';
import { PurchaseItemsService } from './purchase_items.service';
import { PurchaseItemsController } from './purchase_items.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseItem } from './entities/purchase_item.entity';

@Module({
  imports:[TypeOrmModule.forFeature([PurchaseItem])],
  controllers: [PurchaseItemsController],
  providers: [PurchaseItemsService],
  exports:[PurchaseItemsService]
})
export class PurchaseItemsModule {}
