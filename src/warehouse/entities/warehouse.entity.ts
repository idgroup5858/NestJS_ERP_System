import { Stock } from "src/stock/entities/stock.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";



@Entity()
export class Warehouse {


    @PrimaryGeneratedColumn()
    id:number;

    @Column()
    name:string;

    @Column()
    weight:number;

    // @Column()
    // stock:string;

    @CreateDateColumn()
    date:Date;



    @OneToMany(() => Stock, stock => stock.warehouse)
    stock:Stock[];


}
