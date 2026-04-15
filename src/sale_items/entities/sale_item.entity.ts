import { Product } from "src/product/entities/product.entity";
import { Sale } from "src/sale/entities/sale.entity";
import { Warehouse } from "src/warehouse/entities/warehouse.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";



@Entity()
export class SaleItem {

        @PrimaryGeneratedColumn()
        id: number;


        @ManyToOne(() => Sale, sale => sale.items,{onDelete:"CASCADE"})
        sale: Sale;

        @ManyToOne(() => Product)
        product: Product;

        @ManyToOne(() => Warehouse)
        warehouse: Warehouse;

        @Column()
        quantity: number;

        @Column()
        price: number;

        @Column({ default: false })
        checkPrice: boolean;

        @CreateDateColumn()
        date: Date;

}
