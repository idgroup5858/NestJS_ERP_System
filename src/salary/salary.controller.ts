import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { SetSalaryDto } from './dto/salary.dto';
import { SalaryService } from './salary.service';

@Controller('salary')
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) { }

  // GET /salary/sheet?month=2026-10
  @Get('sheet')
  sheet(@Query('month') month?: string) {
    return this.salaryService.sheet(month);
  }

  /** Oklad belgilash / o'zgartirish: { employee_id, amount }. */
  @Post('set')
  set(@Body() dto: SetSalaryDto) {
    return this.salaryService.set(dto);
  }

  @Delete('delete/:employeeId')
  remove(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.salaryService.remove(employeeId);
  }
}
