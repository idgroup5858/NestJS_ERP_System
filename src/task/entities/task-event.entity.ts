import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Task } from "./task.entity";

export const TASK_EVENT_TYPES = [
    'created',   // vazifa ochildi
    'moved',     // etapdan etapga o'tkazildi
    'submitted', // "yopildi" — tekshiruvga yuborildi
    'approved',  // administrator tasdiqladi
    'rejected',  // administrator qaytardi
    'reopened',  // yopilgan vazifa qayta ochildi
    'updated',   // maydonlar o'zgardi
    'comment',   // izoh
    'file_added',   // fayl biriktirildi
    'file_removed', // fayl olib tashlandi
] as const;
export type TaskEventType = (typeof TASK_EVENT_TYPES)[number];

/**
 * Vazifa tarixi. Etap nomlari matn sifatida ham saqlanadi: etap keyin qayta nomlansa
 * yoki o'chirilsa ham tarix o'qiladi.
 */
@Entity()
export class TaskEvent {

    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @ManyToOne(() => Task, task => task.events, { onDelete: 'CASCADE' })
    task: Task;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    user: User | null;

    @Column({ type: 'varchar', length: 20 })
    type: TaskEventType;

    @Column({ type: 'varchar', length: 100, nullable: true })
    fromStage: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    toStage: string | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
