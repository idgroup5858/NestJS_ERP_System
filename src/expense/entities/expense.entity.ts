import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Expense {

    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({ length: 100 })
    category: string;

    // Qaysi oy uchun: oyning birinchi kuni ("2026-10-01"). TypeORM `date` ni satr qilib qaytaradi.
    @Index()
    @Column({ type: 'date' })
    period: string;

    @Column()
    amount: number;

    @Column({ type: 'text', nullable: true })
    comment: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    user: User | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
