import { QUANTITY_COLUMN } from "src/common/quantity";
import { Product } from "src/product/entities/product.entity";
import { ReturnItem } from "src/return_items/entities/return_item.entity";
import { Sale } from "src/sale/entities/sale.entity";
import { SalePaymentItem } from "src/sale/entities/sale-payment-item.entity";
import { Warehouse } from "src/warehouse/entities/warehouse.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";



@Entity()
export class SaleItem {

        @PrimaryGeneratedColumn()
        id: number;


        @ManyToOne(() => Sale, sale => sale.items,{onDelete:"CASCADE"})
        sale: Sale;

        @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
        product: Product;

        @ManyToOne(() => Warehouse)
        warehouse: Warehouse;

        @Column(QUANTITY_COLUMN)
        quantity: number;

        @Column()
        price: number;

        @Column({ default: false })
        checkPrice: boolean;

        // Shu qatordan qaytarilganlar — qayta qaytarishda qolgan miqdorni hisoblash uchun.
        @OneToMany(() => ReturnItem, returnItem => returnItem.saleItem)
        returnItems: ReturnItem[];

        // Shu qator uchun alohida to'langan qarz qismlari ("310 metrdan 10 metri uchun").
        @OneToMany(() => SalePaymentItem, allocation => allocation.saleItem)
        paymentAllocations: SalePaymentItem[];

        @CreateDateColumn()
        date: Date;

}
