import { Category } from "src/category/entities/category.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";


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
    unit:string;
    @Column({nullable:true})
    stock:number;
    @CreateDateColumn()
    date:Date;


    @ManyToOne(() => Category, category => category.products,{onDelete:"CASCADE"})
    category:Category;


}
