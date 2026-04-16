import { CreatePaymentDto } from "src/payment/dto/create-payment.dto";
import { CreatePurchaseItemDto } from "src/purchase_items/dto/create-purchase_item.dto";
import { CreateSaleItemDto } from "src/sale_items/dto/create-sale_item.dto";

export class CreatePurchaseDto {

    customer_id: number;
    user_id: number;
    discount:number;
    items: CreatePurchaseItemDto[];
    payments: CreatePaymentDto[];
}
