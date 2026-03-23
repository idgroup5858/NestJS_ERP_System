import { CreatePaymentDto } from "src/payment/dto/create-payment.dto";
import { CreateReturnItemDto } from "src/return_items/dto/create-return_item.dto";

export class CreateReturnDto {

    customer_id: number;
    user_id: number;
    items: CreateReturnItemDto[];
    payments: CreatePaymentDto[];
}
