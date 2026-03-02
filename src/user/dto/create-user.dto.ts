import { IsEmail, IsString, MinLength } from "class-validator";

export class CreateUserDto {


     
        @IsString()
        username: string;
    
        @IsString()
        surname: string;
    
        @IsString()
        phone: string;
    
        @IsString()
        @IsEmail()
        email: string;
    
        @IsString()
        @MinLength(8)
        password: string;
    
        @IsString()
        role: string;
    
       



}
