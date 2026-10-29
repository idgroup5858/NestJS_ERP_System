import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { SalaryPayment } from './entities/salary-payment.entity';
import { Salary } from './entities/salary.entity';
import { SalaryPaymentController } from './salary-payment.controller';
import { SalaryPaymentService } from './salary-payment.service';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';

@Module({
  imports: [TypeOrmModule.forFeature([Salary, SalaryPayment, User])],
  controllers: [SalaryController, SalaryPaymentController],
  providers: [SalaryService, SalaryPaymentService],
})
export class SalaryModule {}
