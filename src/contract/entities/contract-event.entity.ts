import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Contract } from "./contract.entity";

export const CONTRACT_EVENT_TYPES = [
    'created',
    'status',       // holat qo'lda o'zgartirildi
    'submitted',    // buxgalter yopdi — tekshiruvga yuborildi
    'approved',     // admin tasdiqladi (yopildi)
    'rejected',     // admin qaytardi
    'reopened',     // yopilgan shartnoma qayta ochildi
    'updated',
    'payment',      // buxgalter bank o'tkazmasini kiritdi
    'comment',
    'file_added',
    'file_removed',
] as const;
export type ContractEventType = (typeof CONTRACT_EVENT_TYPES)[number];

@Entity()
export class ContractEvent {

    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @ManyToOne(() => Contract, contract => contract.events, { onDelete: 'CASCADE' })
    contract: Contract;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    user: User | null;

    @Column({ type: 'varchar', length: 20 })
    type: ContractEventType;

    @Column({ type: 'varchar', length: 12, nullable: true })
    fromStatus: string | null;

    @Column({ type: 'varchar', length: 12, nullable: true })
    toStatus: string | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
