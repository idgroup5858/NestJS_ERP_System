import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTelegramDto } from './dto/create-telegram.dto';
import { UpdateTelegramDto } from './dto/update-telegram.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Telegram } from './entities/telegram.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TelegramService {
  constructor(
        @InjectRepository(Telegram)
        private readonly telegramRepository: Repository<Telegram>
      ) { }
      async create(createTelegramDto: CreateTelegramDto) {
    
         
        const task = this.telegramRepository.create(createTelegramDto)
    
        await this.telegramRepository.save(task);
        return task;
      }
    
      async findAll() {
    
        return this.telegramRepository.find({
          relations:["user"]
        });
      }
    
      async findAllPag(page: number, limit: number) {
    
        page = page > 0 ? page : 1;
        limit = limit > 0 ? limit : 10;
    
        const skip = (page - 1) * limit;
    
        const [data, total] = await this.telegramRepository.findAndCount({
          skip,
          take: limit,
          order: { id: 'DESC' }, // ixtiyoriy
          //relations: ["sale", "purchase", "returns"]
        });
    
        return {
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
          data,
    
        };
    
    
      }
    
      async findOne(id: number) {
    
        const checkTelegram = await this.telegramRepository.findOne({
          where:{id},
           //relations: ["sale", "purchase", "returns"]
          });
        if (!checkTelegram) throw new NotFoundException("Не найден");
    
        return checkTelegram;
      }
    
      async update(id: number, updateTelegramDto: UpdateTelegramDto) {
        const checkTelegram = await this.telegramRepository.findOneBy({ id });
        if (!checkTelegram) throw new NotFoundException("Не найден");
    
    
    
        const telegram = await this.telegramRepository.preload({
          id,
          ...updateTelegramDto
        });
    
        if (!telegram) throw new NotFoundException()
    
        await this.telegramRepository.save(telegram)
    
        return telegram;
      }
    
      async remove(id: number) {
        const checkTelegram = await this.telegramRepository.findOneBy({ id });
        if (!checkTelegram) throw new NotFoundException("Не найден");
        await this.telegramRepository.remove(checkTelegram)
        return { message: "удален" };
      }
}
