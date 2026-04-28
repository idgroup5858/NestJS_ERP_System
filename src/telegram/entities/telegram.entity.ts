import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Telegram {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    botName:string;
    @Column()
    botToken:string;

    @OneToMany(() => User, user => user.telegram)
    user:User[];

    @CreateDateColumn()
    date: Date;
    


}
