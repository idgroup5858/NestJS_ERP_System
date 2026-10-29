import { BadRequestException } from '@nestjs/common';
import { MONTH_PATTERN } from 'src/expense/dto/expense.dto';

/** "2026-10" -> "2026-10-01" (`period` ustuni — oyning birinchi kuni). */
export function monthToPeriod(month?: string) {
  if (!month || !MONTH_PATTERN.test(month)) throw new BadRequestException('Месяц должен быть в формате ГГГГ-ММ');
  return `${month}-01`;
}

/** Keyingi oyning boshlanishi (server vaqti bo'yicha): "2026-10" -> 2026-11-01 00:00. */
export function nextMonthStart(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m, 1);
}
