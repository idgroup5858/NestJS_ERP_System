import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentModule } from 'src/attachment/attachment.module';
import { Customer } from 'src/customer/entities/customer.entity';
import { PaymentModule } from 'src/payment/payment.module';
import { Sale } from 'src/sale/entities/sale.entity';
import { Task } from 'src/task/entities/task.entity';
import { TaskModule } from 'src/task/task.module';
import { User } from 'src/user/entities/user.entity';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractEvent } from './entities/contract-event.entity';
import { Contract } from './entities/contract.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, ContractEvent, Task, Customer, User, Sale]), AttachmentModule, TaskModule, PaymentModule],
  controllers: [ContractController],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
