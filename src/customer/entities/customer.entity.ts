import { Sale } from "src/sale/entities/sale.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";


@Entity("customer")
export class Customer {

        @PrimaryGeneratedColumn()
        id: number;
    
        @Column()
        username: string;
    
        @Column()
        surname: string;
    
        @Column({unique:true})
        phone: string;
    
        @Column({default:null})
        sales: string;
    
        @Column({default:0})
        balance: number;
    
        @Column({default:null})
        type: string;
    
        @Column({default:null})
        owner: string;


        @OneToMany(() => Sale, sale => sale.customer)
        sale:Sale[]

        @CreateDateColumn()
        createdAt: Date;


}
