import { Customer } from "src/customer/entities/customer.entity";
import { Payment } from "src/payment/entities/payment.entity";
import { SaleItem } from "src/sale_items/entities/sale_item.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";




@Entity()
export class Sale {

    @PrimaryGeneratedColumn()
    id: number;

    @OneToMany(() => SaleItem, saleItem => saleItem.sale, { cascade: true,onDelete:"CASCADE" })
    items: SaleItem[];

    @OneToMany(() => Payment, payment => payment.sale, { cascade: true,onDelete:"CASCADE" })
    payments: Payment[];


    @ManyToOne(() => Customer, customer => customer.sale)
    customer:Customer;

    @ManyToOne(() => User, user => user.sale)
    user:User;

    @Column({  default: 0 })
    discount: number;

    @Column({  default: 0 })
    total: number;

    @CreateDateColumn()
    date: Date

}
