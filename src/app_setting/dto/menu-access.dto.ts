import { IsInt, IsObject, Min } from "class-validator";

/**
 * Menyu ko'rinishi sozlamasi: `{ "<rol>": { "<bo'lim kaliti>": true | false } }`.
 * Faqat standart qiymatdan farq qiladigan bo'limlar yuboriladi (qolganlari standart bo'yicha).
 * Ichki tuzilma servisda tekshiriladi.
 */
export class UpdateMenuAccessDto {

    /** Kim o'zgartiryapti (faqat Admin). */
    @IsInt()
    @Min(1)
    user_id: number;

    @IsObject()
    overrides: Record<string, unknown>;
}
