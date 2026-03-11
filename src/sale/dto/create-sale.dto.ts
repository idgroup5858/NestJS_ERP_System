import { CreatePaymentDto } from "src/payment/dto/create-payment.dto";
import { CreateSaleItemDto } from "src/sale_items/dto/create-sale_item.dto";

export class CreateSaleDto {


     items: CreateSaleItemDto[];
     payments: CreatePaymentDto[];


}
