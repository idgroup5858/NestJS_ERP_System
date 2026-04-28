import { Purchase } from "src/purchase/entities/purchase.entity";
import { Return } from "src/return/entities/return.entity";
import { Sale } from "src/sale/entities/sale.entity";
import { Task } from "src/task/entities/task.entity";
import { Telegram } from "src/telegram/entities/telegram.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";


@Entity("user")
export class User {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    username: string;

    @Column()
    surname: string;

    @Column()
    phone: string;

    @Column({unique:true})
    email: string;

    @Column()
    password: string;

    @Column()
    role: string;

    @Column({default:null})
    imgUrl: string;

    @Column({default:null})
    telegramAccountId: number;
    

    @OneToMany(() => Sale, sale => sale.user)
    sale:Sale[];

    @OneToMany(() => Purchase, purchase => purchase.user)
    purchase:Purchase[]


    @OneToMany(() => Return, returns => returns.user)
    returns:Return[]

    @OneToMany(() => Task, ownedTasks => ownedTasks.owner)
    ownedTasks:Task[]


    @OneToMany(() => Task, assignedTasks => assignedTasks.assigned)
    assignedTasks:Task[]


    @ManyToOne(() => Telegram , telegam => telegam.user)
    telegram: Telegram;

    @CreateDateColumn()
    createdAt: Date;
}
