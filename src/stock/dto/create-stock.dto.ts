import { IsNumber } from "class-validator";



export class CreateStockDto {

        @IsNumber()
        product_id: number;
        @IsNumber()
        warehouse_id: number;
        @IsNumber()
        quantity: number;
}
