import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Sale } from "./sale.entity";

/**
 * Savdodagi usta xizmati haqi. Bu pul do'konniki emas — ustaning o'ziga beriladi, shuning uchun
 * `sale.total`, chegirma, qarz, foyda va hisobotlarga KIRMAYDI (alohida hisoblanadi): mijoz tovar
 * summasini va ustaga beriladigan haqni alohida to'laydi, kassir haqni ustaga uzatadi.
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

    @Column({ type: "varchar", length: 200, nullable: true })
    note: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
