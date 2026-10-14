import { CreatePaymentDto } from "src/payment/dto/create-payment.dto";
import { CreateSaleItemDto } from "src/sale_items/dto/create-sale_item.dto";

export class SaleMasterFeeDto {
     master_id: number;
     /** Ustaning ulushi: savdo summasiga kirmaydi. */
     amount: number;
     /** Kompaniya ulushi: savdo summasiga qo'shiladi (berilmasa 0). */
     company_amount?: number;
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

     /**
      * Usta xizmati: ustaning ulushi (`amount`) savdo summasiga kirmaydi, ustaga beriladi va alohida hisoblanadi;
      * kompaniya ulushi (`company_amount`) savdo summasiga qo'shiladi.
      */
     master_fees?: SaleMasterFeeDto[];


}
