import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ImportCustomerDto } from './dto/import-customer.dto';

@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post("add")
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerService.create(createCustomerDto);
  }

  @Post("import")
  importMany(@Body() importCustomerDto: ImportCustomerDto) {
    return this.customerService.importMany(importCustomerDto.items);
  }

  @Get("all")
  findAll() {
    return this.customerService.findAll();
  }

  @Get("allpag")
  findAllPag(
    @Query("page") page:string,
    @Query("limit") limit:string
  ) {
    return this.customerService.findAllPag(+page,+limit);
  }

  @Get("allpagsearch")
  findAllPagSearch(
    @Query("page") page:string,
    @Query("limit") limit:string,
    @Query("search") search:string
  ) {
    return this.customerService.findAllPagSearch(+page,+limit,search);
  }

  @Get('getby/:id')
  findOne(@Param('id') id: string) {
    return this.customerService.findOne(+id);
  }

  @Patch('update/:id')
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customerService.update(+id, updateCustomerDto);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.customerService.remove(+id);
  }
}
