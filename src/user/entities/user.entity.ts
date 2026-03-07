import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";


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

    @CreateDateColumn()
    createdAt: Date;
}
