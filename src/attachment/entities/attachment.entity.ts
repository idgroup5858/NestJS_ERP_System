import { Contract } from "src/contract/entities/contract.entity";
import { Task } from "src/task/entities/task.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

/**
 * Vazifa yoki shartnomaga biriktirilgan fayl (pdf, rasm, hujjat ...).
 * Bittasi `task` yoki `contract` dan biriga bog'langan bo'ladi. Fayl o'zi `storage/attachments`
 * da, tasodifiy nom bilan saqlanadi (statik papkada emas): faqat API orqali beriladi.
 */
@Entity()
export class Attachment {

    @PrimaryGeneratedColumn()
    id: number;

    /** Foydalanuvchi yuklagan asl nom (ko'rsatish va yuklab olish uchun). */
    @Column({ length: 255 })
    name: string;

    /** Diskdagi nom (uuid + kengaytma). */
    @Column({ length: 100 })
    storedName: string;

    @Column({ length: 100 })
    mimeType: string;

    @Column()
    size: number;

    @Index()
    @ManyToOne(() => Task, task => task.attachments, { nullable: true, onDelete: 'CASCADE' })
    task: Task | null;

    @Index()
    @ManyToOne(() => Contract, contract => contract.attachments, { nullable: true, onDelete: 'CASCADE' })
    contract: Contract | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    uploadedBy: User | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
