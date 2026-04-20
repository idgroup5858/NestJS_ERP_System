import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Controller('sale')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}


  @Post("addfull")
  createFullSale(@Body() createSaleDto: CreateSaleDto) {
    return this.saleService.createFullSale(createSaleDto);
  }

  // @Post("add")
  // create(@Body() createSaleDto: CreateSaleDto) {
  //   return this.saleService.create(createSaleDto);
  // }

  @Get("allpag")
    findAllPag(
      @Query("page") page: string,
      @Query("limit") limit: string
    ) {
      return this.saleService.findAllPag(+page, +limit);
  }

  @Get("allpagsearch")
  findAllPagSearch(
    @Query("page") page:string,
    @Query("limit") limit:string,
    @Query("search") search:string
  ) {
    return this.saleService.findAllPagSearch(+page,+limit,search);
  }

  @Get("allrange")
    findAllWithRange(
     @Query("start") startDate:string,
     @Query("end") endDate:string
    ) {
      return this.saleService.findAllWithRange(startDate,endDate);
  }

  @Get("alltoday")
  findAllToday() {
    return this.saleService.findTodaySales();
  }

  @Get("allweek")
  findThisWeekSales() {
    return this.saleService.findThisWeekSales();
  }

   @Get("allmonth")
  findThisMonthSales() {
    return this.saleService.findThisMonthSales();
  }

  @Get("all")
  findAll() {
    return this.saleService.findAll();
  }

  @Get("alldebt")
  findAllWithTotalPayed() {
    return this.saleService.findAllWithTotalDebt();
  }

  @Get('getby/:id')
  findOne(@Param('id') id: string) {
    return this.saleService.findOne(+id);
  }

  // @Patch('update/:id')
  // update(@Param('id') id: string, @Body() updateSaleDto: UpdateSaleDto) {
  //   return this.saleService.update(+id, updateSaleDto);
  // }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.saleService.remove(+id);
  }
}
