import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Savdo qilingandan keyin kontragentni almashtirish: kassir adashib boshqa kontragentni tanlagan bo'lishi mumkin.
 * Shu bilan birga savdoni "По договору" ga o'tkazish mumkin: shartnoma (va kuzatuv vazifasi) avtomatik ochiladi.
 *
 * `user_id` — kim bajarmoqda (autentifikatsiya qo'shilguncha shartnoma tarixiga shu yoziladi).
 * `customer_id` va `by_contract` dan kamida bittasi kerak: kontragent o'zgarmasdan faqat shartnoma ochilishi ham mumkin.
 */
export class ChangeSaleCustomerDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    customer_id?: number;

    @IsOptional()
    @IsBoolean()
    by_contract?: boolean;
}
