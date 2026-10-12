import { Purchase } from "src/purchase/entities/purchase.entity";
import { Return } from "src/return/entities/return.entity";
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
    
          
        @Column({default:0})
        balance: number;
    
        @Column({default:null})
        type: string;
    
        @Column({default:null})
        owner: string;

        // Bank rekvizitlari: shartnoma bo'yicha savdoda buxgalter to'ldiradi, keyingi shartnomalarda qayta kiritilmaydi.
        @Column({ type: 'varchar', length: 200, nullable: true })
        orgName: string | null;

        /** STIR (INN). */
        @Column({ type: 'varchar', length: 20, nullable: true })
        inn: string | null;

        @Column({ type: 'varchar', length: 200, nullable: true })
        bankName: string | null;

        @Column({ type: 'varchar', length: 12, nullable: true })
        mfo: string | null;

        /** Hisob raqami (р/с). */
        @Column({ type: 'varchar', length: 34, nullable: true })
        account: string | null;

        @Column({ type: 'varchar', length: 300, nullable: true })
        address: string | null;

        /** Rahbar (direktor). */
        @Column({ type: 'varchar', length: 150, nullable: true })
        director: string | null;


        @OneToMany(() => Sale, sale => sale.customer)
        sale:Sale[]

        @OneToMany(() => Purchase, purchase => purchase.customer)
        purchase:Purchase[]

        @OneToMany(() => Return, returns => returns.customer)
        returns:Return[];

        

        @CreateDateColumn()
        createdAt: Date;


}
