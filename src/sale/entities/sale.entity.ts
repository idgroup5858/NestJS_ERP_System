import { Payment } from "src/payment/entities/payment.entity";
import { SaleItem } from "src/sale_items/entities/sale_item.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";




@Entity()
export class Sale {

    @PrimaryGeneratedColumn()
    id: number;

    @OneToMany(() => SaleItem, saleItem => saleItem.sale, { cascade: true })
    items: SaleItem[];

    @OneToMany(() => Payment, payment => payment.sale, { cascade: true })
    payments: Payment[];

    @Column({ type: 'decimal', default: 0 })
    total: number;

    @CreateDateColumn()
    date: Date

}
