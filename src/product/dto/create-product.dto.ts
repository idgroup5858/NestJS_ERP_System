import { Type } from "class-transformer";
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

        @Type(() => Number)
        @IsNumber()
        price: number;

        @Type(() => Number)
        @IsNumber()
        bulkPrice: number;

        @Type(() => Number)
        @IsNumber()
        buyPrice: number;

        @IsNumber()
        categoryId:number;
        @IsString()
        unit:string;
}
