import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { ChangeSaleCustomerDto } from './dto/change-sale-customer.dto';

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

  /** Ustalar bo'yicha usta xizmati haqlari (savdo summasi va foydadan alohida). */
  @Get('master-fees/summary')
  masterFeesSummary(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.saleService.masterFeesSummary(+(page ?? 1), +(limit ?? 10), search, start, end);
  }

  /** Bitta usta: nechta savdoda qatnashgani, savdo summasi, haqi va sotilgan mahsulotlar. */
  @Get('master-fees/master/:id')
  masterFeeDetail(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.saleService.masterFeeDetail(+id, +(page ?? 1), +(limit ?? 10), start, end);
  }

  @Get('master-fees')
  masterFees(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('master_id') masterId?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.saleService.masterFeesList(+page, +limit, +(masterId ?? 0) || undefined, start, end);
  }

  @Get('getby/:id')
  findOne(@Param('id') id: string) {
    return this.saleService.findOne(+id);
  }

  @Get('detail/:id')
  findDetail(@Param('id') id: string) {
    return this.saleService.findDetail(+id);
  }

  /** Savdo qilingandan keyin kontragentni almashtirish (savdo, qaytarishlar va shartnoma birga o'tadi). */
  @Patch('customer/:id')
  changeCustomer(@Param('id') id: string, @Body() dto: ChangeSaleCustomerDto) {
    return this.saleService.changeCustomer(+id, dto);
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
