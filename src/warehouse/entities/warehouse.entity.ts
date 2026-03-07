import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";



@Entity()
export class Warehouse {


    @PrimaryGeneratedColumn()
    id:number;

    @Column()
    name:string;

    @Column()
    weight:string;

    @Column()
    stock:string;

    @CreateDateColumn()
    date:Date;


}
