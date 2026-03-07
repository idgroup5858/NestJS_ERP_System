import { Optional } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

export class CreateCustomerDto {

            @IsString()
            username: string;
        
            @IsString()
            surname: string;
        
            @IsString()
            phone: string;

            @IsOptional()
            balance: number;

            @IsString()
            type: string;


}
