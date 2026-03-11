import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post("add")
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  @Get("all")
  findAll() {
    return this.paymentService.findAll();
  }

  @Get("allpag")
  findAllPag(
    @Query("page") page:string,
    @Query("limit") limit:string,
  ) {
    return this.paymentService.findAllPag(+page,+limit);
  }

  @Get('getby/:id')
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(+id);
  }

  @Patch('update/:id')
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentService.update(+id, updatePaymentDto);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.paymentService.remove(+id);
  }
}
