import { Customer } from "src/customer/entities/customer.entity";
import { Payment } from "src/payment/entities/payment.entity";
import { PurchaseItem } from "src/purchase_items/entities/purchase_item.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";



@Entity()
export class Purchase {



    @PrimaryGeneratedColumn()
        id: number;
    
        @OneToMany(() => PurchaseItem, purchaseItem => purchaseItem.purchase, { cascade: true,onDelete:"CASCADE" })
        items: PurchaseItem[];
    
        @OneToMany(() => Payment, payment => payment.purchase, { cascade: true,onDelete:"CASCADE" })
        payments: Payment[];
    
    
        @ManyToOne(() => Customer, customer => customer.purchase)
        customer:Customer;
    
        @ManyToOne(() => User, user => user.purchase)
        user:User;
    
        @Column()
        total: number;
    
        @CreateDateColumn()
        date: Date
}
