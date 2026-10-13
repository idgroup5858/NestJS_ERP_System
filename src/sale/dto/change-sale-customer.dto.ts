import { IsInt, Min } from 'class-validator';

/**
 * Savdo qilingandan keyin kontragentni almashtirish: kassir adashib boshqa kontragentni tanlagan bo'lishi mumkin.
 * `user_id` — kim almashtirmoqda (autentifikatsiya qo'shilguncha shartnoma tarixiga shu yoziladi).
 */
export class ChangeSaleCustomerDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @IsInt()
    @Min(1)
    customer_id: number;
}
