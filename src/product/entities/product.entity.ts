import { Category } from "src/category/entities/category.entity";
import { Stock } from "src/stock/entities/stock.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class Product {

    @PrimaryGeneratedColumn()
    id:number;
    @Column()
    name:string;
    @Column({nullable:true})
    code:string;
    @Column({unique:true})
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
    
    @CreateDateColumn()
    date:Date;


    @ManyToOne(() => Category, category => category.products,{onDelete:"CASCADE"})
    category:Category;

    

    @OneToMany(() => Stock, stock => stock.product)
    stock:Stock[]


}
