import { Attachment } from "src/attachment/entities/attachment.entity";
import { Contract } from "src/contract/entities/contract.entity";
import { Customer } from "src/customer/entities/customer.entity";
import { TaskPipeline } from "src/task_pipeline/entities/task_pipeline.entity";
import { TaskStage } from "src/task_pipeline/entities/task_stage.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { TaskEvent } from "./task-event.entity";


export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

@Entity()
export class Task {


    @PrimaryGeneratedColumn()
    id: number;
    @Column()
    title: string;
    // Bo'sh tavsif "" bo'lib saqlanadi (ustun avvaldan NOT NULL).
    @Column()
    description: string;
    @Column()
    priority: string;

    @ManyToOne(() => TaskPipeline , pipeline => pipeline.tasks)
    pipeline: TaskPipeline;

    /** Hozirgi etap: doskadagi ustun. Turi (normal / review / done) holatni belgilaydi. */
    @ManyToOne(() => TaskStage , stage => stage.tasks)
    stage: TaskStage;

    /** Vazifani kim ochgan. */
    @ManyToOne(() => User , user => user.createdTasks, { onDelete: 'SET NULL' })
    creator: User | null;

    /** Asosiy javobgar: statistikada vazifa shu odamga yoziladi. */
    @ManyToOne(() => User , user => user.responsibleTasks, { onDelete: 'SET NULL' })
    responsible: User | null;

    /** Qo'shimcha ijrochilar (javobgardan tashqari). */
    @ManyToMany(() => User)
    @JoinTable({
        name: 'task_participants',
        joinColumn: { name: 'taskId' },
        inverseJoinColumn: { name: 'userId' },
    })
    participants: User[];

    /** Tugash vaqti. Mutlaq lahza saqlanadi (timestamptz), shuning uchun mintaqa farqi xato qilmaydi. */
    @Column({ type: 'timestamptz', nullable: true })
    dueDate: Date | null;

    /** "Yopish" bosgan odam va vaqt: vazifa review etapiga tushgan paytda to'ldiriladi. */
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    submittedBy: User | null;
    @Column({ type: 'timestamptz', nullable: true })
    submittedAt: Date | null;

    /** Administrator tasdiqlagan odam va vaqt (done etapi). */
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    approvedBy: User | null;
    @Column({ type: 'timestamptz', nullable: true })
    approvedAt: Date | null;

    /** Vazifa qaysi shartnoma ustida bajariladi (buxgalter vazifalari uchun). */
    @ManyToOne(() => Contract, contract => contract.tasks, { nullable: true, onDelete: 'SET NULL' })
    contract: Contract | null;

    /**
     * Kontragent (mijoz): vazifa kim bilan bog'liq. Mijozlar jadvali yagona manba — kontragent qayerda
     * ochilmasin, `customer` ga yoziladi. Faqat buxgalter (va admin) biriktiradi.
     */
    @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
    customer: Customer | null;

    @OneToMany(() => Attachment, attachment => attachment.task)
    attachments: Attachment[];

    @OneToMany(() => TaskEvent, event => event.task)
    events: TaskEvent[];

    @UpdateDateColumn()
    updatedAt: Date;

    @CreateDateColumn()
    date: Date;


}
