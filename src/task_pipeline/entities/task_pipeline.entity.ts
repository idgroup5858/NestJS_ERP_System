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

    /**
     * Shartnoma ("По договору" savdosi) vazifalari shu voronkaga tushadi. Faqat bitta voronkada yoqiq turadi;
     * voronka qayta nomlansa ham belgi saqlanadi (nomga bog'lanmagan).
     */
    @Column({ default: false })
    forContracts:boolean;

    @OneToMany(() => TaskStage, stage => stage.pipeline)
    stages:TaskStage[]

    @OneToMany(() => Task ,  tasks => tasks.pipeline)
    tasks:Task[]

    @UpdateDateColumn()
    updatedAt:Date;

    @CreateDateColumn()
    date:Date;
}
