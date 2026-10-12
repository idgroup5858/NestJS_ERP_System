import { Task } from "src/task/entities/task.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { TaskStage } from "./task_stage.entity";


/**
 * Jarayon (voronka): masalan "Обычная задача", "По договору".
 * Etaplari `TaskStage` da; `order_id` — jarayonlar ro'yxatidagi tartib.
 */
@Entity()
export class TaskPipeline {


    @PrimaryGeneratedColumn()
    id:number;

    @Column()
    name:string;

    @Column()
    order_id:number;

    @OneToMany(() => TaskStage, stage => stage.pipeline)
    stages:TaskStage[]

    @OneToMany(() => Task ,  tasks => tasks.pipeline)
    tasks:Task[]

    @UpdateDateColumn()
    updatedAt:Date;

    @CreateDateColumn()
    date:Date;
}
