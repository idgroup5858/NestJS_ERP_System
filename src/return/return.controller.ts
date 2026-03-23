import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ReturnService } from './return.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';

@Controller('return')
export class ReturnController {
  constructor(private readonly returnService: ReturnService) {}

  @Post("addfull")
  create(@Body() createReturnDto: CreateReturnDto) {
    return this.returnService.createFullReturns(createReturnDto);
  }

  @Get("all")
  findAll() {
    return this.returnService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.returnService.findOne(+id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateReturnDto: UpdateReturnDto) {
  //   return this.returnService.update(+id, updateReturnDto);
  // }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.returnService.remove(+id);
  }
}
