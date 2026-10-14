import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Savdo qilingandan keyin usta xizmatini qo'shish (usta kech kelgan bo'lsa).
 * Hisob kassadagidek: `amount` — ustaning ulushi (savdo summasiga kirmaydi), `company_amount` — kompaniya
 * ulushi (savdo summasiga qo'shiladi). `method` — kompaniya ulushi qanday to'landi: "Наличные", "Банковская карта"...;
 * berilmasa yoki "В долг" bo'lsa — to'lov yozilmaydi, ulush savdo qarziga qo'shiladi.
 * `user_id` — kim qo'shmoqda (Telegram xabari va shartnoma tarixi uchun).
 */
export class AddSaleMasterFeeDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @IsInt()
    @Min(1)
    master_id: number;

    @IsInt()
    @Min(0)
    amount: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    company_amount?: number;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    method?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    note?: string;
}
