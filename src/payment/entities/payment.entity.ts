import { Sale } from "src/sale/entities/sale.entity";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";




@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sale, sale => sale.payments , {onDelete:"CASCADE"})
  sale: Sale;

  @Column()
  amount: number;

  @Column()
  method: string; // cash, card, etc
}