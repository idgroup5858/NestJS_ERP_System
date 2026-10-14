import { CreatePaymentDto } from "src/payment/dto/create-payment.dto";
import { CreateSaleItemDto } from "src/sale_items/dto/create-sale_item.dto";

export class SaleMasterFeeDto {
     master_id: number;
     amount: number;
     note?: string;
}

export class CreateSaleDto {


     customer_id:number;
     user_id:number;
     discount:number;
     items: CreateSaleItemDto[];
     payments: CreatePaymentDto[];

     /**
      * Shartnoma ochilsinmi. Berilmasa — "По договору" to'lovi bo'lsa ochiladi (avvalgidek). `false` bo'lsa
      * "По договору" to'lovi bo'lsa ham ochilmaydi; `true` bo'lsa boshqa to'lov turida ham ochiladi
      * (masalan, tashkilotga qarzga yoki naqd sotuv).
      */
     open_contract?: boolean;

     /** Usta xizmati: savdo summasiga kirmaydi, ustaga beriladi va alohida hisoblanadi. */
     master_fees?: SaleMasterFeeDto[];


}
