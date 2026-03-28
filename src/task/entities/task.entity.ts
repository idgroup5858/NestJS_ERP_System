import { TaskPipeline } from "src/task_pipeline/entities/task_pipeline.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";



@Entity()
export class Task {


    @PrimaryGeneratedColumn()
    id: number;
    @Column()
    title: string;
    @Column()
    description: string;
    @Column()
    priority: string;

    @ManyToOne(() => TaskPipeline , pipeline => pipeline.tasks)
    pipeline: TaskPipeline;

    @ManyToOne(() => User , owner => owner.ownedTasks)
    owner: User;

    @ManyToOne(() => User , asigned => asigned.assignedTasks)
    assigned: User;


    @Column({ type: 'datetime', nullable: true })
    dueDate: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @CreateDateColumn()
    date: Date;


}
