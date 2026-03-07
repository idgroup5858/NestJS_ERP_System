import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreateProductDto {


        @IsString()
        name:string;
        @IsOptional()
        code:string;
        @IsOptional()
        barCode:string;
        @IsOptional()
        imgUrl:string;
        @IsNumber()
        price:number;
        @IsNumber()
        bulkPrice:number;
        @IsNumber()
        buyPrice:number;
        @IsString()
        category:string;
        @IsString()
        unit:string;
}
