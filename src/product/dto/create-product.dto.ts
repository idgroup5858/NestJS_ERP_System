import { IsNumber, IsOptional, IsString } from "class-validator";
import { Category } from "src/category/entities/category.entity";

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
        @IsNumber()
        categoryId:number;
        @IsString()
        unit:string;
}
