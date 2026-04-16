import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post("addfull")
  create(@Body() createPurchaseDto: CreatePurchaseDto) {
    return this.purchaseService.createFullPurchase(createPurchaseDto);
  }

  @Get("all")
  findAll() {
    return this.purchaseService.findAll();
  }

  @Get("allpag")
  findAllPag(
    @Query("page") page:string,
    @Query("limit") limit:string
  ) {
    return this.purchaseService.findAllPag(+page,+limit);
  }

   @Get("allpagsearch")
  findAllPagSearch(
    @Query("page") page:string,
    @Query("limit") limit:string,
    @Query("search") search:string
  ) {
    return this.purchaseService.findAllPagSearch(+page,+limit,search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseService.findOne(+id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updatePurchaseDto: UpdatePurchaseDto) {
  //   return this.purchaseService.update(+id, updatePurchaseDto);
  // }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.purchaseService.remove(+id);
  }
}
