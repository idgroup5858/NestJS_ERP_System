import { Body, Controller, Get, Put } from '@nestjs/common';
import { AppSettingService } from './app_setting.service';
import { UpdateMenuAccessDto } from './dto/menu-access.dto';

@Controller('app-setting')
export class AppSettingController {
  constructor(private readonly appSettingService: AppSettingService) {}

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
