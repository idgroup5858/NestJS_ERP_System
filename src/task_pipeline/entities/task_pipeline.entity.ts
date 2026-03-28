import { Task } from "src/task/entities/task.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";


@Entity()
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
