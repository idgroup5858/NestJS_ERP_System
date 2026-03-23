import { Module } from '@nestjs/common';
import { ReturnItemsService } from './return_items.service';
import { ReturnItemsController } from './return_items.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReturnItem } from './entities/return_item.entity';

@Module({
  imports:[TypeOrmModule.forFeature([ReturnItem])],
  controllers: [ReturnItemsController],
  providers: [ReturnItemsService],
  exports:[ReturnItemsService]
})
export class ReturnItemsModule {}
