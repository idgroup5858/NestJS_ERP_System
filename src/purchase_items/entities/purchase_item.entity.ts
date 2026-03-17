import { Product } from "src/product/entities/product.entity";
import { Purchase } from "src/purchase/entities/purchase.entity";
import { Warehouse } from "src/warehouse/entities/warehouse.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";



@Entity()
export class PurchaseItem {


         @PrimaryGeneratedColumn()
        id: number;


        @ManyToOne(() => Purchase, purchase => purchase.items,{onDelete:"CASCADE"})
        purchase: Purchase;

        @ManyToOne(() => Product)
        product: Product;

        @ManyToOne(() => Warehouse)
        warehouse: Warehouse;

        @Column()
        quantity: number;

        @Column()
        price: number;

        @CreateDateColumn()
        date: Date;
}
