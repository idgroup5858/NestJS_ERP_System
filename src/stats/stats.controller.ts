import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) { }

  /** Bugun / hafta / oy / yil tushumi (davr boshidan hozirgacha) + oldingi davrning xuddi shu qismi. */
  @Get('kpis')
  kpis() {
    return this.statsService.kpis();
  }

  /** ?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month|year */
  @Get('dashboard')
  dashboard(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: string,
  ) {
    return this.statsService.dashboard(from, to, granularity);
  }

  /** Yillik kunlik faollik (GitHub uslubidagi kalendar uchun): ?year=2026 */
  @Get('calendar')
  calendar(@Query('year') year?: string) {
    return this.statsService.calendar(year);
  }

  /** Operatsiyalar tarixi: ?page&limit&type=sale|return|purchase|expense&from&to */
  @Get('history')
  history(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statsService.history(+page, +limit, type || undefined, from || undefined, to || undefined);
  }
}
