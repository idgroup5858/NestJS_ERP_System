import { Task } from "src/task/entities/task.entity";
import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { StageColor, StageType } from "../task-stages";
import { TaskPipeline } from "./task_pipeline.entity";


/** Jarayonning bitta etapi (doskadagi ustun). Turi `task-stages.ts` da tushuntirilgan. */
@Entity()
export class TaskStage {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 20, default: 'neutral' })
    color: StageColor;

    @Index()
    @Column({ type: 'varchar', length: 10, default: 'normal' })
    type: StageType;

    @Column({ default: 0 })
    order_id: number;

    @ManyToOne(() => TaskPipeline, pipeline => pipeline.stages, { onDelete: 'CASCADE' })
    pipeline: TaskPipeline;

    @OneToMany(() => Task, task => task.stage)
    tasks: Task[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
