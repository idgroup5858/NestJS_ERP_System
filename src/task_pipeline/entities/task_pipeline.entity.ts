import { Task } from "src/task/entities/task.entity";
import { Column, CreateDateColumn, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export class TaskPipeline {


    @PrimaryGeneratedColumn()
    id:number;

    @Column()
    name:string;

    @Column()
    order_id:number;

    @OneToMany(() => Task ,  tasks => tasks.pipeline)
    tasks:Task[]
    
    @UpdateDateColumn()
    updatedAt:Date;

    @CreateDateColumn()
    date:Date;
}
