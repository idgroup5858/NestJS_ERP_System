import { Customer } from "src/customer/entities/customer.entity";
import { Payment } from "src/payment/entities/payment.entity";
import { ReturnItem } from "src/return_items/entities/return_item.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Return {


    @PrimaryGeneratedColumn()
    id:number;
    @OneToMany(() => ReturnItem, item => item.returns)
    items:ReturnItem[];

    @OneToMany(() => Payment, payments => payments.returns)
    payments:Payment[];

    @ManyToOne(() => Customer, customer => customer.returns)
    customer:Customer;

    @ManyToOne(() => User, user=> user.returns)
    user:User;

    @Column()
    total:number;

    @CreateDateColumn()
    date:Date;



}
