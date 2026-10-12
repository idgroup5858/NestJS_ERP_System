import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Xodimning o'z profili. Rolni bu yerda o'zgartirib bo'lmaydi (faqat "Сотрудники" bo'limida admin o'zgartiradi).
 * Parolni almashtirish uchun joriy parol majburiy.
 */
export class UpdateProfileDto {

    @IsOptional()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите имя' })
    @MaxLength(100)
    username?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите фамилию' })
    @MaxLength(100)
    surname?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(30)
    phone?: string;

    @IsOptional()
    @Transform(trim)
    @IsEmail({}, { message: 'Укажите корректный адрес электронной почты' })
    @MaxLength(150)
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    currentPassword?: string;

    @IsOptional()
    @IsString()
    @MinLength(8, { message: 'Новый пароль должен быть не короче 8 символов' })
    @MaxLength(100)
    newPassword?: string;
}
