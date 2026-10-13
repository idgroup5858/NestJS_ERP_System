import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from "class-validator";

/** user — jismoniy shaxs (odam), organization — tashkilot (idora). */
export const CUSTOMER_TYPES = ['user', 'organization'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const digits = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value);

const isPerson = (o: { type?: string }) => o.type !== 'organization';

/**
 * Kontragent. Odam: ism, familiya va telefon majburiy. Tashkilot: faqat nomi (`orgName`) majburiy —
 * qolgan hamma maydon (telefon ham) ixtiyoriy; ism (`username`) nomdan avtomatik olinadi.
 */
export class CreateCustomerDto {

    @IsOptional()
    @IsIn(CUSTOMER_TYPES, { message: 'Тип: user или organization' })
    type?: CustomerType;

    @ValidateIf(isPerson)
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите имя' })
    @MaxLength(100)
    username?: string;

    @ValidateIf(isPerson)
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите фамилию' })
    @MaxLength(100)
    surname?: string;

    // Odamda majburiy (servis tekshiradi), tashkilotda ixtiyoriy: bo'sh satr — "telefon yo'q".
    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(32)
    phone?: string;

    @IsOptional()
    balance?: number;

    // ---- tashkilot ma'lumotlari / bank rekvizitlari (hammasi ixtiyoriy)

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
