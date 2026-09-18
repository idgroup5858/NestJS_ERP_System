import { ArrayMaxSize, ArrayNotEmpty, IsArray } from "class-validator";

/**
 * Excel/CSV dan keladigan bitta qator. Maydonlar ataylab qat'iy
 * tekshirilmaydi: bitta buzuq qator butun importni yiqitmasligi uchun
 * tekshiruv servis ichida qator-baqator bajariladi va natijada
 * har bir xato qatorning sababi qaytariladi.
 */
export class ImportCustomerItemDto {
    username: string;
    surname: string;
    phone: string;
}

export class ImportCustomerDto {

    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(500)
    items: ImportCustomerItemDto[];
}
