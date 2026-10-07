import { Customer } from "src/customer/entities/customer.entity";
import { Payment } from "src/payment/entities/payment.entity";
import { ReturnItem } from "src/return_items/entities/return_item.entity";
import { Sale } from "src/sale/entities/sale.entity";
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

    // Список продаж ichidan qilingan qaytarish qaysi savdoga tegishli.
    // «Новый возврат» orqali qilinganlarda boʻsh qoladi.
    @ManyToOne(() => Sale, sale => sale.returns, { nullable: true, onDelete: "SET NULL" })
    sale: Sale;

    @Column({  default: 0 })
    discount: number;

    @Column()
    total:number;

    @CreateDateColumn()
    date:Date;



}
