import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { ChangeSaleCustomerDto } from './dto/change-sale-customer.dto';
import { AddSaleMasterFeeDto } from './dto/add-sale-master-fee.dto';

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

  /**
   * Savdolar ro'yxati. `search` — kontragent, sotgan xodim, usta yoki savdo raqami; `debt=true` — faqat qarzi borlar;
   * `master_id`, `user_id` (sotgan xodim), `customer_id` — filtrlar.
   */
  @Get("allpagsearch")
  findAllPagSearch(
    @Query("page") page:string,
    @Query("limit") limit:string,
    @Query("search") search?:string,
    @Query("debt") debt?:string,
    @Query("master_id") masterId?:string,
    @Query("user_id") userId?:string,
    @Query("customer_id") customerId?:string,
  ) {
    const id = (value?: string) => (Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : undefined);
    return this.saleService.findAllPagSearch(+page, +limit, {
      search,
      debt: debt === 'true' || debt === '1',
      masterId: id(masterId),
      userId: id(userId),
      customerId: id(customerId),
    });
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

  /** Savdodan keyin usta xizmatini qo'shish (usta kech kelgan bo'lsa); hisob kassadagidek. */
  @Post('master-fee/:id')
  addMasterFee(@Param('id') id: string, @Body() dto: AddSaleMasterFeeDto) {
    return this.saleService.addMasterFee(+id, dto);
  }

  /** Usta xizmatini o'chirish — faqat admin (`user_id`). */
  @Delete('master-fee/:feeId')
  removeMasterFee(@Param('feeId') feeId: string, @Query('user_id') userId: string) {
    return this.saleService.removeMasterFee(+feeId, +userId);
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
