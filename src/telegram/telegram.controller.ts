import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { CreateTelegramDto } from './dto/create-telegram.dto';
import { UpdateTelegramDto } from './dto/update-telegram.dto';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post("add")
  create(@Body() createTelegramDto: CreateTelegramDto) {
    return this.telegramService.create(createTelegramDto);
  }

  @Get("all")
  findAll() {
    return this.telegramService.findAll();
  }

  @Get('getby/:id')
  findOne(@Param('id') id: string) {
    return this.telegramService.findOne(+id);
  }

  @Patch('update/:id')
  update(@Param('id') id: string, @Body() updateTelegramDto: UpdateTelegramDto) {
    return this.telegramService.update(+id, updateTelegramDto);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.telegramService.remove(+id);
  }
}
