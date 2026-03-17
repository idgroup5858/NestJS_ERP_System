import { Purchase } from "src/purchase/entities/purchase.entity";
import { Sale } from "src/sale/entities/sale.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";


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

    @OneToMany(() => Sale, sale => sale.user)
    sale:Sale[];

    @OneToMany(() => Purchase, purchase => purchase.user)
    purchase:Purchase[]

    @CreateDateColumn()
    createdAt: Date;
}
