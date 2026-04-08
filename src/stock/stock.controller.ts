import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post("add")
  create(@Body() createStockDto: CreateStockDto) {
    return this.stockService.create(createStockDto);
  }

  @Post("updatefilter")
  updateFilter(@Body() createStockDto: CreateStockDto) {
    return this.stockService.updateFilter(createStockDto);
  }

  @Get("all")
  findAll() {
    return this.stockService.findAll();
  }

  @Get("allpag")
  findAllPag(
    @Query("page") page:string,
    @Query("limit") limit:string
  ) {
    return this.stockService.findAllPag(+page,+limit);
  }

  @Get("allpagsearch")
  findAllPagSearch(
    @Query("page") page:string,
    @Query("limit") limit:string,
    @Query("search") search:string
  ) {
    return this.stockService.findAllPagSearch(+page,+limit,search);
  }


  @Get('getby/:id')
  findOne(@Param('id') id: string) {
    return this.stockService.findOne(+id);
  }

  @Patch('update/:id')
  update(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.stockService.update(+id, updateStockDto);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.stockService.remove(+id);
  }
}
