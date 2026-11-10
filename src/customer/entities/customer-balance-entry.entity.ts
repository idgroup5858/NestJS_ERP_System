import { Payment } from "src/payment/entities/payment.entity";
import { Return } from "src/return/entities/return.entity";
import { Sale } from "src/sale/entities/sale.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Customer } from "./customer.entity";

/**
 * Balans yozuvi turlari:
 *  - `deposit`  (+) mijoz oldindan pul berdi (avans) — kassaga kirim;
 *  - `return`   (+) qaytarish summasi naqd berilmay balansga yozildi;
 *  - `sale`     (−) balansdan savdo yoki savdo qarzi to'landi (savdoda «С баланса» to'lovi);
 *  - `withdraw` (−) balansdagi pul mijozga qaytarib berildi — kassadan chiqim.
 */
export const BALANCE_ENTRY_TYPES = ['deposit', 'return', 'sale', 'withdraw'] as const;
export type BalanceEntryType = (typeof BALANCE_ENTRY_TYPES)[number];

/**
 * Mijoz balansining harakatlari. Balans — shu yozuvlar yig'indisi; `customer.balance` ustuni
 * bazadagi trigger orqali shu yig'indiga teng tutiladi (o'chirishlar kaskadida ham).
 *
 * Savdo yoki qaytarish o'chirilsa — unga bog'langan to'lov va shu yozuv ham o'chadi, balans tiklanadi.
 */
@Entity("customer_balance_entry")
export class CustomerBalanceEntry {

    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @ManyToOne(() => Customer, { nullable: false, onDelete: "CASCADE" })
    customer: Customer;

    /** Ishorali summa: + balansga tushdi, − balansdan chiqdi. */
    @Column({ type: "int" })
    amount: number;

    @Column({ type: "varchar", length: 20 })
    type: BalanceEntryType;

    /** Pul qanday berildi yoki olindi (`deposit` / `withdraw` da: «Наличные», «Click» …), qolganlarida bo'sh. */
    @Column({ type: "varchar", length: 50, nullable: true })
    method: string | null;

    @ManyToOne(() => Sale, { nullable: true, onDelete: "CASCADE" })
    sale: Sale | null;

    @ManyToOne(() => Return, { nullable: true, onDelete: "CASCADE" })
    returns: Return | null;

    /** Savdodagi «С баланса» yoki qaytarishdagi «На баланс» to'lovi — u o'chirilsa yozuv ham o'chadi. */
    @ManyToOne(() => Payment, { nullable: true, onDelete: "CASCADE" })
    payment: Payment | null;

    /** Amalni bajargan xodim. */
    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    user: User | null;

    @Column({ type: "varchar", length: 200, nullable: true })
    note: string | null;

    @CreateDateColumn()
    date: Date;
}
