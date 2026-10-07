import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Telegram } from './entities/telegram.entity';
import { TelegramChat } from './entities/telegram-chat.entity';
import { TelegramBotService } from './telegram-bot.service';

@Module({
  imports:[TypeOrmModule.forFeature([Telegram, TelegramChat])],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramBotService],
  exports:[TelegramService, TelegramBotService]
})
export class TelegramModule {}
