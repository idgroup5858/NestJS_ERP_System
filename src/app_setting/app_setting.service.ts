import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { UpdateMenuAccessDto } from './dto/menu-access.dto';
import { AppSetting } from './entities/app_setting.entity';

export const MENU_ACCESS_KEY = 'menu_access';

/** Sozlanadigan rollar. Admin doim hamma bo'limni ko'radi, shuning uchun bu yerda yo'q. */
export const MENU_ROLES = ['user', 'accountant', 'master'] as const;

/** Menyu bo'limi kaliti (web'dagi `key`: first, tasks, contracts, ...). */
const ITEM_KEY = /^[a-z][a-z0-9_]{1,23}$/;
const MAX_ITEMS_PER_ROLE = 50;

export type MenuOverrides = Record<string, Record<string, boolean>>;

@Injectable()
export class AppSettingService {

  constructor(
    @InjectRepository(AppSetting)
    private readonly settings: Repository<AppSetting>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) { }

  /** Hamma foydalanuvchi o'qiydi (menyuni shu bo'yicha quradi); ichida maxfiy narsa yo'q. */
  async getMenuAccess() {
    const row = await this.settings.findOne({ where: { key: MENU_ACCESS_KEY } });
    return {
      overrides: (row?.value ?? {}) as MenuOverrides,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async setMenuAccess(dto: UpdateMenuAccessDto) {
    const actor = await this.users.findOneBy({ id: dto.user_id });
    if (!actor) throw new NotFoundException(`Пользователь #${dto.user_id} не найден`);
    if (actor.role?.trim().toLowerCase() !== 'admin') {
      throw new ForbiddenException('Настройки меню может менять только администратор');
    }

    await this.settings.save(this.settings.create({
      key: MENU_ACCESS_KEY,
      value: this.sanitize(dto.overrides),
      updatedBy: actor,
    }));
    return this.getMenuAccess();
  }

  /** Tuzilmani qat'iy tekshiradi va faqat ruxsat etilgan rol/kalit/bool qiymatlarni qoldiradi. */
  private sanitize(input: Record<string, unknown>): MenuOverrides {
    const result: MenuOverrides = {};

    for (const [role, items] of Object.entries(input)) {
      if (!(MENU_ROLES as readonly string[]).includes(role)) {
        throw new BadRequestException(`Неизвестная роль «${role}». Допустимо: ${MENU_ROLES.join(', ')}`);
      }
      if (items === null || typeof items !== 'object' || Array.isArray(items)) {
        throw new BadRequestException(`Для роли «${role}» ожидается объект { раздел: true | false }`);
      }

      const entries = Object.entries(items as Record<string, unknown>);
      if (entries.length > MAX_ITEMS_PER_ROLE) {
        throw new BadRequestException(`Слишком много разделов для роли «${role}»`);
      }

      const clean: Record<string, boolean> = {};
      for (const [key, visible] of entries) {
        if (!ITEM_KEY.test(key)) throw new BadRequestException(`Недопустимый ключ раздела «${key}»`);
        if (typeof visible !== 'boolean') {
          throw new BadRequestException(`Значение раздела «${key}» должно быть true или false`);
        }
        clean[key] = visible;
      }
      if (Object.keys(clean).length > 0) result[role] = clean;
    }
    return result;
  }
}
