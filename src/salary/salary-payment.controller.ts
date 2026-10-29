import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateSalaryPaymentDto, UpdateSalaryPaymentDto } from './dto/salary-payment.dto';
import { SalaryPaymentService } from './salary-payment.service';

@Controller('salary-payment')
export class SalaryPaymentController {
  constructor(private readonly salaryPaymentService: SalaryPaymentService) { }

  @Post('add')
  create(@Body() dto: CreateSalaryPaymentDto) {
    return this.salaryPaymentService.create(dto);
  }

  // GET /salary-payment/allpagsearch?page=1&limit=15&month=2026-10&employee=3&type=advance&search=Ali
  @Get('allpagsearch')
  findAllPagSearch(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('month') month?: string,
    @Query('employee') employee?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.salaryPaymentService.findAllPagSearch(+page, +limit, {
      month,
      employee: Number(employee) || undefined,
      type,
      search,
    });
  }

  @Get('getby/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.salaryPaymentService.findOne(id);
  }

  @Patch('update/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSalaryPaymentDto) {
    return this.salaryPaymentService.update(id, dto);
  }

  @Delete('delete/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.salaryPaymentService.remove(id);
  }
}
