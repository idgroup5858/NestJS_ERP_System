import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Stock {


    @PrimaryGeneratedColumn()
    id:number;
    @Column()
    product_id:number;
    @Column()
    warehouse_id:number;
    @Column()
    quantity:number;
    @CreateDateColumn()
    date:Date;
}
