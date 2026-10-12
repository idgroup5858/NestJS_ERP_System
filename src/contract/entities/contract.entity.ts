import { Attachment } from "src/attachment/entities/attachment.entity";
import { Customer } from "src/customer/entities/customer.entity";
import { Sale } from "src/sale/entities/sale.entity";
import { Task } from "src/task/entities/task.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { ContractStatus } from "../contract-statuses";
import { ContractEvent } from "./contract-event.entity";

/** bigint ustuni satr qaytaradi; summalar JS son sifatida ishlatiladi (9e15 gacha aniq). */
const NUMERIC = {
    to: (value?: number | null) => value,
    from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
};

@Entity()
export class Contract {

    @PrimaryGeneratedColumn()
    id: number;

    /** Shartnoma raqami (takrorlanmaydi). Berilmasa "D-0001" ko'rinishida beriladi. */
    @Index({ unique: true })
    @Column({ length: 50 })
    number: string;

    @Column({ type: 'text', nullable: true })
    subject: string | null;

    /** Kontragent (mijozlar jadvalidan). */
    @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
    customer: Customer | null;

    /**
     * "По договору" savdosidan ochilgan bo'lsa — o'sha savdo. Bog'langan shartnomada summa, valyuta va
     * kontragent savdodan olinadi (o'zgartirilmaydi); tovarlar va to'lovlar savdodan ko'rinadi.
     */
    @OneToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn()
    sale: Sale | null;

    @Column({ type: 'bigint', default: 0, transformer: NUMERIC })
    amount: number;

    @Column({ type: 'varchar', length: 3, default: 'UZS' })
    currency: string;

    /** Shartnoma sanasi: "2026-10-15". */
    @Column({ type: 'date', nullable: true })
    contractDate: string | null;

    @Index()
    @Column({ type: 'varchar', length: 12, default: 'draft' })
    status: ContractStatus;

    /** Shartnoma bilan shug'ullanuvchi buxgalter: yopilganda statistikada shunga yoziladi. */
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    responsible: User | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    creator: User | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    submittedBy: User | null;
    @Column({ type: 'timestamptz', nullable: true })
    submittedAt: Date | null;

    /** Yopilganda: kim yopdi (javobgar buxgalter), qachon va kim tasdiqladi (admin). */
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    closedBy: User | null;
    @Column({ type: 'timestamptz', nullable: true })
    closedAt: Date | null;
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    approvedBy: User | null;

    @OneToMany(() => Task, task => task.contract)
    tasks: Task[];

    @OneToMany(() => Attachment, attachment => attachment.contract)
    attachments: Attachment[];

    @OneToMany(() => ContractEvent, event => event.contract)
    events: ContractEvent[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
