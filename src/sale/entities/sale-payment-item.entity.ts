import { QUANTITY_COLUMN } from "src/common/quantity";
import { Payment } from "src/payment/entities/payment.entity";
import { SaleItem } from "src/sale_items/entities/sale_item.entity";
import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

/**
 * Qarz to'lovi qaysi tovar uchun: "310 metrdan 10 metri uchun to'ladi". Bitta to'lov bir nechta qatorga
 * bo'linishi mumkin. Qatorning to'lanmagan qismi = sotilgan − qaytarilgan − shu yozuvlar yig'indisi.
 *
 * To'lov yoki savdo qatori o'chirilsa — yozuv ham o'chadi.
 */
@Entity("sale_payment_item")
export class SalePaymentItem {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Payment, payment => payment.allocations, { nullable: false, onDelete: "CASCADE" })
    payment: Payment;

    @Index()
    @ManyToOne(() => SaleItem, saleItem => saleItem.paymentAllocations, { nullable: false, onDelete: "CASCADE" })
    saleItem: SaleItem;

    /** Nechta (metr, kg …) uchun to'landi. */
    @Column(QUANTITY_COLUMN)
    quantity: number;

    /** To'lovning shu qatorga tushgan qismi (so'm). */
    @Column({ type: "int" })
    amount: number;
}
