import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ExpenseCategoryDto } from './dto/expense-category.dto';
import { ExpenseCategoryService } from './expense-category.service';

/** Xarajat turlari ro'yxati (UI dagi tanlov va filtr). */
@Controller('expense-category')
export class ExpenseCategoryController {
  constructor(private readonly expenseCategoryService: ExpenseCategoryService) { }

  /** `[{ id, name, count }]` — `count`: shu turdagi xarajatlar soni. */
  @Get('getall')
  findAll() {
    return this.expenseCategoryService.findAll();
  }

  @Post('add')
  create(@Body() dto: ExpenseCategoryDto) {
    return this.expenseCategoryService.create(dto);
  }

  /** Qayta nomlash: shu turdagi xarajatlar ham yangi nomga o'tadi. */
  @Patch('update/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: ExpenseCategoryDto) {
    return this.expenseCategoryService.update(id, dto);
  }

  /** `?move_to=<id>` — turda xarajatlar bo'lsa majburiy: ular shu turga o'tkaziladi. */
  @Delete('delete/:id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('move_to', new ParseIntPipe({ optional: true })) moveTo?: number,
  ) {
    return this.expenseCategoryService.remove(id, moveTo);
  }
}
