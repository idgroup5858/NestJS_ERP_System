import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTelegramDto } from './dto/create-telegram.dto';
import { UpdateTelegramDto } from './dto/update-telegram.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Telegram } from './entities/telegram.entity';
import { TelegramChat } from './entities/telegram-chat.entity';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { newConnectCode, TelegramApiError, TelegramBotService } from './telegram-bot.service';

@Injectable()
export class TelegramService {
  constructor(
        @InjectRepository(Telegram)
        private readonly telegramRepository: Repository<Telegram>,
        @InjectRepository(TelegramChat)
        private readonly chatRepository: Repository<TelegramChat>,
        private readonly telegramBot: TelegramBotService
      ) { }

      /**
       * Bot qoʻshish: token Telegram (getMe) orqali tekshiriladi, botning
       * @username i olinadi va bot darhol ishga tushadi.
       */
      async create(createTelegramDto: CreateTelegramDto) {

        const botToken = createTelegramDto.botToken.trim();

        let me: { first_name: string, username: string };
        try {
          me = await this.telegramBot.call(botToken, 'getMe');
        } catch (e) {
          if (e instanceof TelegramApiError && (e.code === 401 || e.code === 404)) {
            throw new BadRequestException("Неверный токен. Скопируйте его заново из @BotFather.");
          }
          throw new BadRequestException("Нет связи с Telegram. Проверьте интернет и попробуйте снова.");
        }

        const existing = await this.telegramRepository.findOne({
          where: [{ botToken }, { username: me.username }]
        });
        if (existing) throw new ConflictException(`Бот @${me.username} уже подключён`);

        const bot = this.telegramRepository.create({
          botName: createTelegramDto.botName?.trim() || me.first_name,
          botToken,
          username: me.username,
          connectCode: newConnectCode()
        });
        await this.telegramRepository.save(bot);

        this.telegramBot.start(bot);
        return this.toView({ ...bot, chats: [] });
      }

      private toView(bot: Telegram) {
        return {
          id: bot.id,
          botName: bot.botName,
          username: bot.username,
          // Toʻliq token frontend ga chiqarilmaydi.
          tokenHint: `${bot.botToken.slice(0, 10)}…`,
          link: bot.username && bot.connectCode ? `https://t.me/${bot.username}?start=${bot.connectCode}` : null,
          ...this.telegramBot.status(bot.id),
          chats: (bot.chats ?? []).map(chat => ({
            id: chat.id,
            title: chat.title,
            username: chat.username,
            date: chat.date
          })),
          date: bot.date
        };
      }

      /** Интеграция sahifasi uchun: holati va ulangan chatlari bilan. */
      async findAllBots() {
        const bots = await this.telegramRepository.find({
          relations: ["chats"],
          order: { id: "ASC", chats: { id: "ASC" } }
        });
        return bots.map(bot => this.toView(bot));
      }

      async removeChat(id: number) {
        const chat = await this.chatRepository.findOneBy({ id });
        if (!chat) throw new NotFoundException("Не найден");
        await this.chatRepository.remove(chat);
        return { message: "удален" };
      }

      /** Yangi ulanish havolasi — eskisi orqali endi ulanib boʻlmaydi (ulanganlar qoladi). */
      async regenerateLink(id: number) {
        const bot = await this.telegramRepository.findOne({ where: { id }, relations: ["chats"] });
        if (!bot) throw new NotFoundException("Не найден");
        bot.connectCode = newConnectCode();
        await this.telegramRepository.save(bot);
        return this.toView(bot);
      }

      async sendTest(id: number) {
        const bot = await this.telegramRepository.findOneBy({ id });
        if (!bot) throw new NotFoundException("Не найден");

        const delivered = await this.telegramBot.broadcast(
          "✅ Тестовое сообщение из ERP. Уведомления работают.",
          id
        );
        return { delivered };
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

        // Token oʻzgargan boʻlishi mumkin — yangisi bilan qayta ishga tushiramiz.
        this.telegramBot.start(telegram);

        return telegram;
      }

      async remove(id: number) {
        const checkTelegram = await this.telegramRepository.findOneBy({ id });
        if (!checkTelegram) throw new NotFoundException("Не найден");

        this.telegramBot.stop(id);
        // Xodimlarning eski bogʻlanishi oʻchirishga xalaqit bermasin.
        await this.telegramRepository.manager.update(User, { telegram: { id } }, { telegram: null as any });

        await this.telegramRepository.remove(checkTelegram)
        return { message: "удален" };
      }
}
