import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ImportCustomerDto } from './dto/import-customer.dto';
import { CustomerProfileService } from './customer-profile.service';
import { CustomerOperationsQueryDto } from './dto/customer-operations-query.dto';

@Controller('customer')
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly profileService: CustomerProfileService,
  ) {}

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
    @Query("search") search:string,
    // organization — faqat tashkilotlar, user — faqat odamlar; yuborilmasa hammasi.
    @Query("type") type?: string
  ) {
    return this.customerService.findAllPagSearch(+page,+limit,search,type);
  }

  /** Kontragent kartochkasi: ma'lumot, savdo/qaytarish/xarid jamlanmasi, to'lov usullari, top tovarlar, 12 oy. */
  @Get('profile/:id')
  profile(@Param('id') id: string) {
    return this.profileService.profile(+id);
  }

  /** Kontragent bilan barcha operatsiyalar (savdo, qaytarish, xarid): qatorlar va to'lovlar bilan, sahifalangan. */
  @Get('operations/:id')
  operations(@Param('id') id: string, @Query() query: CustomerOperationsQueryDto) {
    return this.profileService.operations(+id, query.page ?? 1, query.limit ?? 10, query.type);
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
