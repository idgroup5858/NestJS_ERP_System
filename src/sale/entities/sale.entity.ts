import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";




@Entity()
export class Sale {

    @PrimaryGeneratedColumn()
    id: number;
    @Column()
    payment_type: string;
    @Column()
    price_type: string;
    @Column()
    sale_type: string;
    @Column()
    total_cost: number;
    @CreateDateColumn()
    date: Date




}
