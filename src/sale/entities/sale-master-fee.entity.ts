import { Payment } from "src/payment/entities/payment.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Sale } from "./sale.entity";

/**
 * Savdodagi usta xizmati. Xizmat narxi ikki qismga bo'linadi:
 *  - `amount` — ustaning ulushi. Bu pul do'konniki emas — ustaga beriladi, shuning uchun `sale.total`,
 *    chegirma, qarz, foyda va hisobotlarga KIRMAYDI (alohida hisoblanadi): kassir uni ustaga uzatadi;
 *  - `companyAmount` — kompaniya ulushi: savdo summasiga (`sale.total`) qo'shiladi va tovarlar bilan birga
 *    to'lanadi, qarz, tushum va foydaga kiradi (tannarxi yo'q).
 * Masalan, xizmat 520 000: ustaga 500 000 (`amount`), kompaniyaga 20 000 (`companyAmount`).
 */
@Entity()
export class SaleMasterFee {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Sale, sale => sale.masterFees, { nullable: false, onDelete: "CASCADE" })
    sale: Sale;

    // Usta xodim o'chirilsa ham yozuv qoladi (usta nomi "—" bo'ladi).
    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    master: User | null;

    @Column()
    amount: number;

    // Kompaniya ulushi: savdo summasiga kiradi (yuqoridagi izohga qarang).
    @Column({ default: 0 })
    companyAmount: number;

    @Column({ type: "varchar", length: 200, nullable: true })
    note: string | null;

    /**
     * Savdodan keyin qo'shilgan xizmatda kompaniya ulushi shu zahoti to'langan bo'lsa — o'sha to'lov
     * (kassadagi savdoda ulush umumiy to'lov ichida, bu yerda `null`). Xizmat o'chirilsa, bu to'lov ham o'chadi.
     */
    @ManyToOne(() => Payment, { nullable: true, onDelete: "SET NULL" })
    payment: Payment | null;

    @CreateDateColumn()
    createdAt: Date;
}
