import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { Expense } from './entities/expense.entity';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, User])],
  controllers: [ExpenseController],
  providers: [ExpenseService],
})
export class ExpenseModule {}
