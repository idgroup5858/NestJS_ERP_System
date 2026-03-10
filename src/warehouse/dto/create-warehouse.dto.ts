import { IsNumber, IsString } from "class-validator";

export class CreateWarehouseDto {


        @IsString()
        name:string;
    
        @IsNumber()
        weight:number;
    
}
