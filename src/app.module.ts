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

@Module({
  imports: [CustomerModule, UserModule, WarehouseModule, ProductModule, SaleModule, StockModule, PaymentModule, SaleItemsModule, DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
