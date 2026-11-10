import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Bitta amaldagi summa chegarasi (int ustunga sig'ishi uchun). */
export const BALANCE_MAX_AMOUNT = 2_000_000_000;

/** Balansni to'ldirish (mijoz pul olib keldi) yoki balansdagi pulni mijozga qaytarish. */
export class BalanceMoneyDto {

    @Type(() => Number)
    @IsInt({ message: 'Сумма должна быть целым числом' })
    @Min(1, { message: 'Сумма должна быть больше нуля' })
    @Max(BALANCE_MAX_AMOUNT)
    amount: number;

    /** Pul qanday berildi/olindi: «Наличные», «Банковская карта», «Click» … */
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Выберите способ оплаты' })
    @MaxLength(50)
    method: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    user_id?: number;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(200)
    note?: string;
}

/**
 * Qarzni balansdan yopish. `sale_id` berilsa — faqat shu savdo, aks holda eng eski qarzdan boshlab hammasi.
 * `amount` — ko'pi bilan shuncha (berilmasa: balans yoki qarz, qaysi kichik bo'lsa).
 */
export class BalancePayDto {

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    sale_id?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Сумма должна быть целым числом' })
    @Min(1, { message: 'Сумма должна быть больше нуля' })
    @Max(BALANCE_MAX_AMOUNT)
    amount?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    user_id?: number;
}

/**
 * Mijoz qarz uchun pul berdi. Pul qarzni yopadi (`sale_id` — faqat shu savdo, bo'lmasa eng eski qarzdan boshlab),
 * ortgani (qaytim) `keep_change` bo'lsa (standart) — mijoz balansiga, aks holda qaytim qo'lga berilgan hisoblanadi.
 */
export class AcceptPaymentDto extends BalanceMoneyDto {

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    sale_id?: number;

    /** Qaytim balansga yozilsinmi (standart: ha). `false` — qaytim mijozga naqd berildi, faqat qarz yopiladi. */
    @IsOptional()
    @IsBoolean()
    keep_change?: boolean;
}

export const BALANCE_HISTORY_MAX_LIMIT = 100;

export class BalanceHistoryQueryDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(BALANCE_HISTORY_MAX_LIMIT) limit?: number;
}
