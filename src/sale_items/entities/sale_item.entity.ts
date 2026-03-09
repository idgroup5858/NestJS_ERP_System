import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";



@Entity()
export class SaleItem {

        @PrimaryGeneratedColumn()
        id:number;
        @Column()
        product_id:number;
        @Column()
        quantity:number;
        @Column()
        price:number;
        @CreateDateColumn()
        date:Date;

}
