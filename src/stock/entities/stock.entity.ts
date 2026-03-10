import { Product } from "src/product/entities/product.entity";
import { Warehouse } from "src/warehouse/entities/warehouse.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Stock {


    @PrimaryGeneratedColumn()
    id: number;
   
    @Column()
    quantity: number;
    @CreateDateColumn()
    date: Date;


    @ManyToOne(() => Product, product => product.stock)
    product: Product;

    @ManyToOne(() => Warehouse, warehouse => warehouse.stock)
    warehouse: Warehouse;
}
