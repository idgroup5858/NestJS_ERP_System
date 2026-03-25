import { CreatePaymentDto } from "src/payment/dto/create-payment.dto";
import { CreateSaleItemDto } from "src/sale_items/dto/create-sale_item.dto";

export class CreateSaleDto {


     customer_id:number;
     user_id:number;
     discount:number;
     items: CreateSaleItemDto[];
     payments: CreatePaymentDto[];


}
