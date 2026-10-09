import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { ExpenseService } from './expense.service';

@Controller('expense')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) { }

  @Get('categories')
  categories() {
    return this.expenseService.categories();
  }

  @Post('add')
  create(@Body() dto: CreateExpenseDto) {
    return this.expenseService.create(dto);
  }

  @Get('allpagsearch')
  findAllPagSearch(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('month') month?: string,
  ) {
    return this.expenseService.findAllPagSearch(+page, +limit, { search, category, month });
  }

  @Get('getby/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.expenseService.findOne(id);
  }

  @Patch('update/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto) {
    return this.expenseService.update(id, dto);
  }

  @Delete('delete/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.expenseService.remove(id);
  }
}
