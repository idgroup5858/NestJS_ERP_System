import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { MasterOrderService } from './master_order.service';
import {
  CancelMasterOrderDto, CompleteMasterOrderDto, CreateMasterOrderDto, SetMasterOrderStatusDto
} from './dto/master-order.dto';

/** `master_id` hozircha so'rovdan keladi; autentifikatsiya qo'shilganda tokendan olinadi. */
const masterIdOf = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestException('master_id обязателен');
  return id;
};

@Controller('master-order')
export class MasterOrderController {
  constructor(private readonly masterOrderService: MasterOrderService) { }

  // ------------------------------------------------------------ usta

  @Get('categories')
  categories() {
    return this.masterOrderService.listCategories();
  }

  @Get('products')
  products(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.masterOrderService.listProducts(+page, +limit, search, +(categoryId ?? 0) || undefined);
  }

  @Post('add')
  create(@Body() dto: CreateMasterOrderDto) {
    return this.masterOrderService.create(dto);
  }

  @Get('mine')
  findMine(
    @Query('master_id') masterId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status?: string,
  ) {
    return this.masterOrderService.findMine(masterIdOf(masterId), +page, +limit, status);
  }

  @Get('mine/:id')
  findMineOne(@Param('id', ParseIntPipe) id: number, @Query('master_id') masterId: string) {
    return this.masterOrderService.findMineOne(masterIdOf(masterId), id);
  }

  @Patch('mine/:id')
  updateMine(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateMasterOrderDto) {
    return this.masterOrderService.updateMine(id, dto);
  }

  @Patch('mine/:id/cancel')
  cancelMine(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelMasterOrderDto) {
    return this.masterOrderService.cancelMine(dto.master_id, id);
  }

  // ------------------------------------------------------------ admin

  @Get('count-new')
  countNew() {
    return this.masterOrderService.countNew();
  }

  @Get('allpagsearch')
  findAllPagSearch(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.masterOrderService.findAllPagSearch(+page, +limit, search, status);
  }

  @Get('getby/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.masterOrderService.findOne(id);
  }

  @Patch('status/:id')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetMasterOrderStatusDto) {
    return this.masterOrderService.setStatus(id, dto.status);
  }

  @Post('complete/:id')
  complete(@Param('id', ParseIntPipe) id: number, @Body() dto: CompleteMasterOrderDto) {
    return this.masterOrderService.complete(id, dto.sale_id);
  }
}
