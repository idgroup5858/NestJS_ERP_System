import { Product } from "src/product/entities/product.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";




@Entity()
export class Category {



        @PrimaryGeneratedColumn()
        id: number;
        @Column({unique:true})
        name: string;
        @CreateDateColumn()
        date: Date;


        @OneToMany(() => Product, product => product.category)
        products:Product[];


}
