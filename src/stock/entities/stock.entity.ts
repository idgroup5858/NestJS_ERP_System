import { Product } from "src/product/entities/product.entity";
import { User } from "src/user/entities/user.entity";
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


    @ManyToOne(() => Product, product => product.stock,{onDelete:"CASCADE"})
    product: Product;

    @ManyToOne(() => Warehouse, warehouse => warehouse.stock)
    warehouse: Warehouse;

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable:true})
    user: User;
}
