import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Telegram } from './entities/telegram.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Telegram])],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports:[TelegramService]
})
export class TelegramModule {}
