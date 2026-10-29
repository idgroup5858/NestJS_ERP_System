import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/** `advance` — avans, `salary` — oylikning qolgan qismi. */
export const SALARY_PAYMENT_TYPES = ['advance', 'salary'] as const;
export type SalaryPaymentType = (typeof SALARY_PAYMENT_TYPES)[number];

export const SALARY_PAYMENT_METHODS = ['cash', 'card', 'transfer'] as const;
export type SalaryPaymentMethod = (typeof SALARY_PAYMENT_METHODS)[number];

/** Oylik to'lovi: kimga, qaysi oy uchun, qancha va qanday. */
@Entity()
@Index(['employee', 'period'])
export class SalaryPayment {

    @PrimaryGeneratedColumn()
    id: number;

    // Xodim o'chirilsa ham to'lov qoladi — o'tgan oylarning xarajat va foyda hisobi o'zgarmasligi uchun.
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    employee: User | null;

    // Qaysi oy uchun: oyning birinchi kuni ("2026-10-01"). TypeORM `date` ni satr qilib qaytaradi.
    @Index()
    @Column({ type: 'date' })
    period: string;

    // Shu oyning oklad normasi: birinchi to'lovda muhrlanadi, oyning barcha to'lovlarida bir xil.
    // Keyin oklad o'zgarsa ham o'tgan oylar hisobi o'zgarmaydi.
    @Column()
    norm: number;

    @Column()
    amount: number;

    @Column({ length: 20 })
    type: SalaryPaymentType;

    @Column({ length: 20, default: 'cash' })
    method: SalaryPaymentMethod;

    @Column({ type: 'text', nullable: true })
    comment: string | null;

    // Kim kiritgan.
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    user: User | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
