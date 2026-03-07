import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";


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
    
        @CreateDateColumn()
        createdAt: Date;


}
