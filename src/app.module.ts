import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomerModule } from './customer/customer.module';
import { UserModule } from './user/user.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { ProductModule } from './product/product.module';
import { SaleModule } from './sale/sale.module';
import { StockModule } from './stock/stock.module';
import { PaymentModule } from './payment/payment.module';
import { SaleItemsModule } from './sale_items/sale_items.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { CategoryModule } from './category/category.module';
import { PurchaseModule } from './purchase/purchase.module';
import { PurchaseItemsModule } from './purchase_items/purchase_items.module';
import { ReturnModule } from './return/return.module';
import { ReturnItemsModule } from './return_items/return_items.module';
import { TaskPipelineModule } from './task_pipeline/task_pipeline.module';
import { TaskModule } from './task/task.module';

@Module({
  imports: [CustomerModule, UserModule, WarehouseModule, ProductModule, SaleModule, StockModule, PaymentModule, SaleItemsModule, DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CategoryModule,
    PurchaseModule,
    PurchaseItemsModule,
    ReturnModule,
    ReturnItemsModule,
    TaskPipelineModule,
    TaskModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
