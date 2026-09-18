import { IsEmail, IsNotEmpty, IsString } from "class-validator";


export class LoginDto {

    @IsString()
    @IsEmail()
    email:string;

    // Uzunlik faqat parol yaratishda tekshiriladi: standart admin paroli ("admin") qisqa.
    @IsString()
    @IsNotEmpty()
    password:string;
}