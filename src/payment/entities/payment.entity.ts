import { Purchase } from "src/purchase/entities/purchase.entity";
import { Sale } from "src/sale/entities/sale.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";




@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sale, sale => sale.payments , {onDelete:"CASCADE",nullable:true})
  sale: Sale;

  @ManyToOne(() => Purchase, purchase => purchase.payments , {onDelete:"CASCADE",nullable:true})
  purchase: Purchase;

  @Column()
  amount: number;

  @Column()
  method: string; // cash, card, etc

  @CreateDateColumn()
  date:Date
}