import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { CustomerProfileService } from './customer-profile.service';
import { CustomerBalanceService } from './customer-balance.service';
import { CustomerBalanceController } from './customer-balance.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { CustomerBalanceEntry } from './entities/customer-balance-entry.entity';
import { TelegramModule } from 'src/telegram/telegram.module';

@Module({
  imports:[TypeOrmModule.forFeature([Customer, CustomerBalanceEntry]), TelegramModule],
  controllers: [CustomerBalanceController, CustomerController],
  providers: [CustomerService, CustomerProfileService, CustomerBalanceService],
  // Savdo va qaytarish balansdan to'lash / balansga yozish uchun ishlatadi.
  exports: [CustomerBalanceService],
})
export class CustomerModule {}
