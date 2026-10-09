import { Sale } from "src/sale/entities/sale.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { MasterOrderItem } from "./master-order-item.entity";

export const MASTER_ORDER_STATUSES = ['new', 'preparing', 'ready', 'completed', 'cancelled'] as const;
export type MasterOrderStatus = (typeof MASTER_ORDER_STATUSES)[number];

@Entity()
export class MasterOrder {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { nullable: false })
    master: User;

    @Column({ type: 'varchar', length: 20, default: 'new' })
    status: MasterOrderStatus;

    // Usta yozgan mijoz ma'lumoti: kontragentni kassir o'zi yaratadi.
    @Column()
    customerName: string;

    @Column()
    customerPhone: string;

    @Column({ type: 'text', nullable: true })
    address: string | null;

    @Column({ type: 'text', nullable: true })
    mapUrl: string | null;

    // Savdo chekiga qo'shilmaydi — faqat ma'lumot uchun.
    @Column({ default: 0 })
    serviceFee: number;

    @ManyToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
    sale: Sale | null;

    @OneToMany(() => MasterOrderItem, item => item.order, { cascade: true })
    items: MasterOrderItem[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
