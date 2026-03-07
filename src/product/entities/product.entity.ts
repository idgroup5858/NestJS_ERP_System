import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Product {

    @PrimaryGeneratedColumn()
    id:number;
    @Column()
    name:string;
    @Column({nullable:true})
    code:string;
    @Column()
    barCode:string;
    @Column({nullable:true})
    imgUrl:string;
    @Column()
    price:number;
    @Column()
    bulkPrice:number;
    @Column()
    buyPrice:number;
    @Column()
    category:string;
    @Column()
    unit:string;
    @Column({nullable:true})
    stock:number;
    @CreateDateColumn()
    date:Date


}
