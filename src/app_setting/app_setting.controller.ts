import { Body, Controller, Get, Put } from '@nestjs/common';
import { AppSettingService } from './app_setting.service';
import { UpdateMenuAccessDto } from './dto/menu-access.dto';
import { UpdateAppearanceDto } from './dto/appearance.dto';

@Controller('app-setting')
export class AppSettingController {
  constructor(private readonly appSettingService: AppSettingService) {}

  /** Tizimning asosiy rangi: `{ accent: "indigo", updatedAt }`. Hamma o'qiydi. */
  @Get('appearance')
  getAppearance() {
    return this.appSettingService.getAppearance();
  }

  /** Faqat administrator (`user_id`): rang hamma foydalanuvchida o'zgaradi. */
  @Put('appearance')
  setAppearance(@Body() dto: UpdateAppearanceDto) {
    return this.appSettingService.setAppearance(dto);
  }

  /** Menyu bo'limlari rollar bo'yicha: `{ overrides: { user: { contracts: true } }, updatedAt }`. */
  @Get('menu-access')
  getMenuAccess() {
    return this.appSettingService.getMenuAccess();
  }

  /** Faqat administrator (`user_id`). `overrides` to'liq almashtiriladi. */
  @Put('menu-access')
  setMenuAccess(@Body() dto: UpdateMenuAccessDto) {
    return this.appSettingService.setMenuAccess(dto);
  }
}
