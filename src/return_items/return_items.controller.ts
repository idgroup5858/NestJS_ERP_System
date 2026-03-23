import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ReturnItemsService } from './return_items.service';
import { CreateReturnItemDto } from './dto/create-return_item.dto';
import { UpdateReturnItemDto } from './dto/update-return_item.dto';

@Controller('return-items')
export class ReturnItemsController {
  constructor(private readonly returnItemsService: ReturnItemsService) {}

  @Post()
  create(@Body() createReturnItemDto: CreateReturnItemDto) {
    return this.returnItemsService.create(createReturnItemDto);
  }

  @Get()
  findAll() {
    return this.returnItemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.returnItemsService.findOne(+id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateReturnItemDto: UpdateReturnItemDto) {
  //   return this.returnItemsService.update(+id, updateReturnItemDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.returnItemsService.remove(+id);
  }
}
