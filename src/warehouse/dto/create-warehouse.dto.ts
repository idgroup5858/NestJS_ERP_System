import { IsString } from "class-validator";

export class CreateWarehouseDto {


        @IsString()
        name:string;
    
        @IsString()
        weight:string;
    
        @IsString()
        stock:string;
}
