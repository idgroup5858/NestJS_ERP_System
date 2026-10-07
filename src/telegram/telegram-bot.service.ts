import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Between, DataSource, Repository } from 'typeorm';
import { Telegram } from './entities/telegram.entity';
import { TelegramChat } from './entities/telegram-chat.entity';
import { Sale } from 'src/sale/entities/sale.entity';
import { Return } from 'src/return/entities/return.entity';
import { OFFSET_METHOD } from 'src/payment/payment-methods';

export type BotStatus = 'starting' | 'running' | 'offline' | 'conflict' | 'error' | 'stopped';
type Period = 'day' | 'week' | 'month';

interface Runner {
  botId: number;
  token: string;
  abort: AbortController;
  status: BotStatus;
  error?: string;
}

export class TelegramApiError extends Error {
  constructor(readonly code: number, description: string) {
    super(description);
  }
}

const BUTTONS: Record<Period, string> = {
  day: '📊 Сегодня',
  week: '📅 Неделя',
  month: '🗓 Месяц',
};

const KEYBOARD = {
  keyboard: [[{ text: BUTTONS.day }, { text: BUTTONS.week }, { text: BUTTONS.month }]],
  resize_keyboard: true,
  is_persistent: true,
};
const NO_KEYBOARD = { remove_keyboard: true };

const WELCOME =
  '✅ <b>Подключено.</b>\n\nСюда будут приходить все продажи и возвраты.\n' +
  'Кнопки ниже показывают сумму продаж за день, неделю и месяц.';
const DENIED =
  '🔒 Доступ закрыт.\n\nОткройте ссылку подключения из программы ERP ' +
  '(Интеграция → Telegram) и нажмите «Start».';
const HELP = 'Выберите период кнопкой ниже.';

// Telegram xabari 4096 belgidan oshmasligi kerak — tovarlar roʻyxati shu chegaragacha.
const ITEMS_TEXT_LIMIT = 3000;
// ERP oʻchiq turganda bosilgan tugmalarga keyin javob yogʻdirmaslik uchun.
const STALE_REQUEST_SECONDS = 300;

const money = (value: number) => `${Math.round(value)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const fmtDateTime = (d: Date) => `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const esc = (value: unknown) =>
  `${value ?? ''}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const person = (p?: { username?: string, surname?: string } | null) =>
  p ? `${p.username ?? ''} ${p.surname ?? ''}`.trim() : '';

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });

export const newConnectCode = () => randomBytes(12).toString('base64url');

function periodStart(period: Period, now: Date) {
  const start = new Date(now);
  if (period === 'week') {
    // Hafta dushanbadan (bosh sahifadagi «haftalik» bilan bir xil).
    const day = now.getDay();
    start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  } else if (period === 'month') {
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);
  return start;
}

function periodOf(text: string, command: string | null): Period | null {
  if (command === '/today' || command === '/day' || text.includes('Сегодня')) return 'day';
  if (command === '/week' || text.includes('Неделя')) return 'week';
  if (command === '/month' || text.includes('Месяц')) return 'month';
  return null;
}

/**
 * Telegram botlarini ishlatadi: har bir bot uchun long polling (kompyuter
 * tashqaridan koʻrinmaydi, shuning uchun webhook emas), ulanish havolasi
 * orqali obuna, savdo/qaytarish xabarlari va davr boʻyicha hisobotlar.
 *
 * Telegram bilan muammo (internet yoʻq, token xato) savdoga hech qachon
 * taʼsir qilmaydi: xabarlar javobni kutmasdan, xatolar faqat logga yoziladi.
 */
@Injectable()
export class TelegramBotService implements OnApplicationBootstrap, OnModuleDestroy {

  private readonly logger = new Logger(TelegramBotService.name);
  private readonly runners = new Map<number, Runner>();

  constructor(
    @InjectRepository(Telegram)
    private readonly botRepository: Repository<Telegram>,
    @InjectRepository(TelegramChat)
    private readonly chatRepository: Repository<TelegramChat>,
    private readonly dataSource: DataSource,
  ) { }

  async onApplicationBootstrap() {
    const bots = await this.botRepository.find();
    for (const bot of bots) {
      if (!bot.connectCode) {
        bot.connectCode = newConnectCode();
        await this.botRepository.save(bot);
      }
      this.start(bot);
    }
  }

  onModuleDestroy() {
    for (const botId of [...this.runners.keys()]) this.stop(botId);
  }

  start(bot: Telegram) {
    this.stop(bot.id);
    const runner: Runner = { botId: bot.id, token: bot.botToken, abort: new AbortController(), status: 'starting' };
    this.runners.set(bot.id, runner);
    void this.poll(runner);
  }

  stop(botId: number) {
    this.runners.get(botId)?.abort.abort();
    this.runners.delete(botId);
  }

  status(botId: number): { status: BotStatus, error: string | null } {
    const runner = this.runners.get(botId);
    return runner ? { status: runner.status, error: runner.error ?? null } : { status: 'stopped', error: null };
  }

  /** Telegram Bot API chaqiruvi; `ok: false` boʻlsa TelegramApiError. */
  async call<T = any>(token: string, method: string, body: object = {}, signal?: AbortSignal, timeoutMs = 15000): Promise<T> {
    const signals = [AbortSignal.timeout(timeoutMs)];
    if (signal) signals.push(signal);

    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.any(signals),
    });
    const data: any = await res.json().catch(() => null);
    if (!data?.ok) throw new TelegramApiError(data?.error_code ?? res.status, data?.description ?? res.statusText);
    return data.result;
  }

  private setStatus(runner: Runner, status: BotStatus, error?: string) {
    if (runner.status === status && runner.error === error) return;
    if (status !== 'running') this.logger.warn(`bot #${runner.botId}: ${status}${error ? ` — ${error}` : ''}`);
    runner.status = status;
    runner.error = error;
  }

  private async poll(runner: Runner) {
    const { signal } = runner.abort;
    let offset = 0;
    let delay = 0;

    while (!signal.aborted) {
      try {
        const updates = await this.call<any[]>(
          runner.token,
          'getUpdates',
          { offset, timeout: 25, allowed_updates: ['message'] },
          signal,
          35000,
        );
        this.setStatus(runner, 'running');
        delay = 0;

        for (const update of updates) {
          offset = update.update_id + 1;
          if (!update.message) continue;
          await this.handleMessage(runner, update.message)
            .catch(e => this.logger.warn(`bot #${runner.botId}: ${e.message}`));
        }
      } catch (e) {
        if (signal.aborted) break;

        if (e instanceof TelegramApiError && (e.code === 401 || e.code === 404)) {
          this.setStatus(runner, 'error', 'Неверный токен бота');
          return;
        }
        if (e instanceof TelegramApiError && e.code === 409 && /webhook/i.test(e.message)) {
          // Bot avval boshqa joyda webhook bilan ishlatilgan — polling uchun oʻchiramiz.
          await this.call(runner.token, 'deleteWebhook', {}, signal).catch(() => undefined);
          continue;
        }
        if (e instanceof TelegramApiError && e.code === 409) {
          this.setStatus(runner, 'conflict', 'Бот уже используется другой программой или на другом компьютере');
          delay = 30000;
        } else if (e instanceof TelegramApiError) {
          this.setStatus(runner, 'error', e.message);
          delay = 15000;
        } else {
          this.setStatus(runner, 'offline', 'Нет связи с Telegram');
          delay = Math.min(60000, delay ? delay * 2 : 5000);
        }
        await sleep(delay, signal);
      }
    }
  }

  private reply(runner: Runner, chatId: string, text: string, markup: object) {
    return this.call(runner.token, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: markup,
    });
  }

  private async handleMessage(runner: Runner, message: any) {
    const chatId = String(message.chat.id);
    const isPrivate = message.chat.type === 'private';
    const text: string = `${message.text ?? ''}`.trim();
    if (!text) return;

    const [head, ...args] = text.split(/\s+/);
    // Guruhlarda buyruq «/start@BotName» koʻrinishida keladi.
    const command = head.startsWith('/') ? head.split('@')[0].toLowerCase() : null;

    const chat = await this.chatRepository.findOne({ where: { bot: { id: runner.botId }, chatId } });

    if (command === '/start') {
      if (!chat) {
        const bot = await this.botRepository.findOneBy({ id: runner.botId });
        if (!bot?.connectCode || args[0] !== bot.connectCode) {
          await this.reply(runner, chatId, DENIED, NO_KEYBOARD);
          return;
        }
        const title = isPrivate
          ? `${message.chat.first_name ?? ''} ${message.chat.last_name ?? ''}`.trim()
          : message.chat.title;
        await this.chatRepository.save(this.chatRepository.create({
          bot: { id: runner.botId },
          chatId,
          title: title || null,
          username: message.chat.username ?? message.from?.username ?? null,
        } as Partial<TelegramChat>));
      }
      await this.reply(runner, chatId, WELCOME, KEYBOARD);
      return;
    }

    if (!chat) {
      // Guruhdagi begona xabarlarga javob bermaymiz — faqat shaxsiy chatda.
      if (isPrivate) await this.reply(runner, chatId, DENIED, NO_KEYBOARD);
      return;
    }

    if (command === '/stop') {
      await this.chatRepository.remove(chat);
      await this.reply(runner, chatId, 'Уведомления отключены.', NO_KEYBOARD);
      return;
    }

    const period = periodOf(text, command);
    if (period) {
      if (Date.now() / 1000 - message.date > STALE_REQUEST_SECONDS) return;
      await this.reply(runner, chatId, await this.report(period), KEYBOARD);
      return;
    }

    if (isPrivate) await this.reply(runner, chatId, HELP, KEYBOARD);
  }

  /** Davr boshidan hozirgacha: savdolar, qaytarishlar va sof summa. */
  async report(period: Period) {
    const now = new Date();
    const start = periodStart(period, now);
    const manager = this.dataSource.manager;

    const sales = await manager.find(Sale, { where: { date: Between(start, now) }, relations: ['payments'] });
    const returns = await manager.find(Return, { where: { date: Between(start, now) } });

    const salesSum = sales.reduce((sum, s) => sum + s.total - s.discount, 0);
    const returnsSum = returns.reduce((sum, r) => sum + r.total - r.discount, 0);
    const unpaid = sales.reduce((sum, s) => {
      const paid = s.payments.reduce((acc, p) => acc + p.amount, 0);
      return sum + Math.max(0, s.total - s.discount - paid);
    }, 0);

    const title = {
      day: `📊 <b>Сегодня</b> · ${fmtDate(now)}`,
      week: `📅 <b>Неделя</b> · ${fmtDate(start)} – ${fmtDate(now)}`,
      month: `🗓 <b>Месяц</b> · ${fmtDate(start)} – ${fmtDate(now)}`,
    }[period];

    const lines = [title, '', `Продажи: ${sales.length} шт. — ${money(salesSum)}`];
    if (returns.length) lines.push(`Возвраты: ${returns.length} шт. — −${money(returnsSum)}`);
    lines.push(`<b>Итого: ${money(salesSum - returnsSum)} so'm</b>`);
    if (unpaid > 0) lines.push(`⚠️ Не оплачено (в долг): ${money(unpaid)}`);
    return lines.join('\n');
  }

  /** Savdo haqida xabar. Kutilmaydi — savdo javobini sekinlashtirmaydi. */
  notifySale(saleId: number) {
    void this.safely(async () => {
      const sale = await this.dataSource.manager.findOne(Sale, {
        where: { id: saleId },
        relations: ['items', 'items.product', 'payments', 'customer', 'user'],
        order: { items: { id: 'ASC' } },
      });
      if (sale) await this.broadcast(this.formatSale(sale));
    });
  }

  /** Qaytarish haqida xabar. Kutilmaydi. */
  notifyReturn(returnId: number) {
    void this.safely(async () => {
      const ret = await this.dataSource.manager.findOne(Return, {
        where: { id: returnId },
        relations: ['items', 'items.product', 'payments', 'customer', 'user', 'sale'],
        order: { items: { id: 'ASC' } },
      });
      if (ret) await this.broadcast(this.formatReturn(ret));
    });
  }

  private async safely(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      this.logger.warn(`notify: ${e instanceof Error ? e.message : e}`);
    }
  }

  /** Barcha botlarning barcha ulangan chatlariga. Natija: nechta chatga yetdi. */
  async broadcast(text: string, botId?: number) {
    const bots = await this.botRepository.find({
      where: botId ? { id: botId } : {},
      relations: ['chats'],
    });
    let delivered = 0;

    for (const bot of bots) {
      if (this.runners.get(bot.id)?.error === 'Неверный токен бота') continue;

      for (const chat of bot.chats) {
        try {
          await this.call(bot.botToken, 'sendMessage', { chat_id: chat.chatId, text, parse_mode: 'HTML' });
          delivered++;
        } catch (e) {
          // Foydalanuvchi botni bloklagan yoki bot guruhdan chiqarilgan — endi yubormaymiz.
          if (e instanceof TelegramApiError && e.code === 403) await this.chatRepository.remove(chat);
          else this.logger.warn(`bot #${bot.id} → ${chat.chatId}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
    return delivered;
  }

  private formatItems(items: { product?: { name: string } | null, quantity: number, price: number, checkPrice?: boolean }[]) {
    const lines: string[] = [];
    let length = 0;

    for (const [index, item] of items.entries()) {
      const line =
        `${index + 1}. ${esc(item.product?.name ?? 'Товар удалён')}\n` +
        `      ${item.quantity} × ${money(item.price)} = <b>${money(item.quantity * item.price)}</b>` +
        (item.checkPrice ? ' (опт)' : '');
      if (length + line.length > ITEMS_TEXT_LIMIT) {
        lines.push(`… и ещё ${items.length - index} поз.`);
        break;
      }
      lines.push(line);
      length += line.length;
    }
    return lines;
  }

  private header(icon: string, title: string, date: Date, user?: any, customer?: any) {
    const lines = [`${icon} <b>${title}</b>`, `🕒 ${fmtDateTime(date)}`];
    if (person(user)) lines.push(`👤 ${esc(person(user))}`);
    if (person(customer)) lines.push(`🧾 Клиент: ${esc(person(customer))}${customer.phone ? `, ${esc(customer.phone)}` : ''}`);
    return lines;
  }

  private formatSale(sale: Sale) {
    const net = sale.total - sale.discount;
    const paid = sale.payments.reduce((sum, p) => sum + p.amount, 0);

    const lines = [
      ...this.header('🛒', `Продажа #${sale.id}`, sale.date, sale.user, sale.customer),
      '',
      ...this.formatItems(sale.items),
      '',
    ];
    if (sale.discount > 0) {
      lines.push(`Сумма: ${money(sale.total)}`, `Скидка: −${money(sale.discount)}`);
    }
    lines.push(`<b>Итого: ${money(net)} so'm</b>`);
    for (const p of sale.payments) {
      if (p.amount > 0) lines.push(`${p.method === 'Наличные' ? '💵' : '💳'} ${esc(p.method)}: ${money(p.amount)}`);
    }
    if (net - paid > 0) lines.push(`⚠️ В долг: ${money(net - paid)}`);
    return lines.join('\n');
  }

  private formatReturn(ret: Return) {
    const value = ret.total - ret.discount;
    const title = `Возврат #${ret.id}${ret.sale ? ` · из продажи #${ret.sale.id}` : ''}`;

    const lines = [
      ...this.header('↩️', title, ret.date, ret.user, ret.customer),
      '',
      ...this.formatItems(ret.items),
      '',
      `<b>Сумма возврата: ${money(value)} so'm</b>${ret.discount > 0 ? ' (с учётом скидки)' : ''}`,
    ];
    for (const p of ret.payments) {
      if (p.method === OFFSET_METHOD) lines.push(`➖ Списано с долга: ${money(p.amount)}`);
      else if (p.amount > 0) lines.push(`💵 Выдано клиенту (${esc(p.method)}): ${money(p.amount)}`);
    }
    return lines.join('\n');
  }
}
