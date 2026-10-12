import { Transform, Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { CONTRACT_CURRENCIES, CONTRACT_STATUSES, MANUAL_STATUSES } from "../contract-statuses";
import type { ContractStatus } from "../contract-statuses";

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** "YYYY-MM-DD" (haqiqiy kalendar kuni). */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Дата должна быть в формате ГГГГ-ММ-ДД';

export class CreateContractDto {

    /** Berilmasa avtomatik: "D-0001". */
    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(50)
    number?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(2000)
    subject?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    customer_id?: number;

    @IsOptional()
    @IsInt({ message: 'Сумма должна быть целым числом' })
    @Min(0)
    @Max(9_000_000_000_000)
    amount?: number;

    @IsOptional()
    @IsIn(CONTRACT_CURRENCIES)
    currency?: string;

    @IsOptional()
    @Matches(DATE_ONLY, { message: DATE_MESSAGE })
    @IsDateString({ strict: true }, { message: DATE_MESSAGE })
    contractDate?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    responsible_id?: number;

    /** Boshlang'ich holat (qo'lda tanlanadigan); berilmasa "draft". */
    @IsOptional()
    @IsIn(MANUAL_STATUSES)
    status?: ContractStatus;

    /** Kim ochyapti. */
    @IsInt()
    @Min(1)
    user_id: number;
}

/** `customer_id`, `contractDate`, `responsible_id` ga `null` — tozalaydi; yuborilmasa — o'zgarmaydi. */
export class UpdateContractDto {

    @IsOptional()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите номер договора' })
    @MaxLength(50)
    number?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(2000)
    subject?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    customer_id?: number | null;

    @IsOptional()
    @IsInt({ message: 'Сумма должна быть целым числом' })
    @Min(0)
    @Max(9_000_000_000_000)
    amount?: number;

    @IsOptional()
    @IsIn(CONTRACT_CURRENCIES)
    currency?: string;

    @IsOptional()
    @Matches(DATE_ONLY, { message: DATE_MESSAGE })
    @IsDateString({ strict: true }, { message: DATE_MESSAGE })
    contractDate?: string | null;

    @IsOptional()
    @IsInt()
    @Min(1)
    responsible_id?: number | null;

    /** Kim o'zgartiryapti (ruxsatni tekshirish va tarix uchun). */
    @IsInt()
    @Min(1)
    user_id: number;
}

/** Holatni qo'lda o'zgartirish: draft / signed / active / cancelled. */
export class ContractStatusDto {

    @IsIn(MANUAL_STATUSES, { message: 'Статус: draft, signed, active или cancelled' })
    status: ContractStatus;

    @IsInt()
    @Min(1)
    user_id: number;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(2000)
    note?: string;
}

/** `submit` va `approve`. */
export class ContractActionDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(2000)
    note?: string;
}

/** `reject` va `comment`: izoh majburiy. */
export class ContractNoteDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Напишите комментарий' })
    @MaxLength(2000)
    note: string;
}

/** Rekvizitlar (kontragent kartasiga yoziladi). Bo'sh qator — maydonni tozalaydi; yuborilmasa — o'zgarmaydi. */
const digits = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value);

export class ContractRequisitesDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(200)
    orgName?: string;

    /** STIR: 9 raqam (jismoniy shaxs — 14). */
    @IsOptional()
    @Transform(digits)
    @Matches(/^(\d{9,14})?$/, { message: 'ИНН: от 9 до 14 цифр' })
    inn?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(200)
    bankName?: string;

    @IsOptional()
    @Transform(digits)
    @Matches(/^(\d{3,9})?$/, { message: 'МФО: только цифры (обычно 5)' })
    mfo?: string;

    /** Hisob raqami (р/с): odatda 20 raqam. */
    @IsOptional()
    @Transform(digits)
    @Matches(/^(\d{10,34})?$/, { message: 'Расчётный счёт: только цифры (обычно 20)' })
    account?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(300)
    address?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(150)
    director?: string;
}

/** Bank o'tkazmasini kiritish: qarz kamayadi. */
export class ContractPaymentDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @IsInt({ message: 'Сумма должна быть целым числом' })
    @Min(1, { message: 'Сумма должна быть больше нуля' })
    @Max(9_000_000_000_000)
    amount: number;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(500)
    note?: string;
}

export class ContractListQueryDto {

    @IsOptional() @Type(() => Number) @IsInt() page?: number;
    @IsOptional() @Type(() => Number) @IsInt() limit?: number;

    /**
     * Kim so'rayapti (majburiy, yo'q bo'lsa 400). Administrator hamma shartnomani ko'radi,
     * qolganlar faqat o'ziga tegishlisini (javobgar, ochgan yoki shartnomadagi vazifasi bor).
     */
    @IsOptional() @Type(() => Number) @IsInt() user_id?: number;

    /** Raqam, mavzu yoki kontragent ismi/telefoni. */
    @IsOptional() @IsString() @MaxLength(200) search?: string;

    @IsOptional() @IsIn(CONTRACT_STATUSES) status?: ContractStatus;

    /** Hali buxgalter olmagan ("свободные") shartnomalar: savdodan ochilgan va javobgarsiz. */
    @IsOptional() @Transform(({ value }) => value === true || value === 'true' || value === '1') unassigned?: boolean;

    @IsOptional() @Type(() => Number) @IsInt() responsible_id?: number;
    /** Kim yopgan (tasdiqlangan shartnomalar bo'yicha). */
    @IsOptional() @Type(() => Number) @IsInt() closed_by_id?: number;
    @IsOptional() @Type(() => Number) @IsInt() customer_id?: number;

    /** Shartnoma sanasi oralig'i. */
    @IsOptional() @Matches(DATE_ONLY, { message: DATE_MESSAGE }) from?: string;
    @IsOptional() @Matches(DATE_ONLY, { message: DATE_MESSAGE }) to?: string;

    /** Yopilgan sana oralig'i (biznes vaqt mintaqasida). */
    @IsOptional() @Matches(DATE_ONLY, { message: DATE_MESSAGE }) closed_from?: string;
    @IsOptional() @Matches(DATE_ONLY, { message: DATE_MESSAGE }) closed_to?: string;
}
