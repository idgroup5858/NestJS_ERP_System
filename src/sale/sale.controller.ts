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

  @Get("all")
  findAll() {
    return this.saleService.findAll();
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
