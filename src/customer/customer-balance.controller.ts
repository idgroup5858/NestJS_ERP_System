import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CustomerBalanceService } from './customer-balance.service';
import { BalanceHistoryQueryDto, BalanceMoneyDto, BalancePayDto } from './dto/customer-balance.dto';

/** Mijoz balansi: holati va tarixi, to'ldirish, pulni qaytarish, qarzni balansdan yopish. */
@Controller('customer/balance')
export class CustomerBalanceController {
  constructor(private readonly balanceService: CustomerBalanceService) {}

  /** Balans, qarz, jamlanma va harakatlar tarixi (sahifalangan, yangilari tepada). */
  @Get(':id')
  history(@Param('id', ParseIntPipe) id: number, @Query() query: BalanceHistoryQueryDto) {
    return this.balanceService.history(id, query.page ?? 1, query.limit ?? 20);
  }

  /** Mijoz pul olib keldi — balansga (kassaga kirim). */
  @Post(':id/deposit')
  deposit(@Param('id', ParseIntPipe) id: number, @Body() dto: BalanceMoneyDto) {
    return this.balanceService.deposit(id, dto);
  }

  /** Balansdagi pulni mijozga qaytarish (kassadan chiqim). */
  @Post(':id/withdraw')
  withdraw(@Param('id', ParseIntPipe) id: number, @Body() dto: BalanceMoneyDto) {
    return this.balanceService.withdraw(id, dto);
  }

  /** Qarzni balansdan yopish: `sale_id` — bitta savdo, bo'lmasa eng eski qarzdan boshlab. */
  @Post(':id/pay')
  pay(@Param('id', ParseIntPipe) id: number, @Body() dto: BalancePayDto) {
    return this.balanceService.payDebts(id, dto);
  }
}
