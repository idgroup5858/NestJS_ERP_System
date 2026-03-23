import { Purchase } from "src/purchase/entities/purchase.entity";
import { Return } from "src/return/entities/return.entity";
import { Sale } from "src/sale/entities/sale.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";




@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sale, sale => sale.payments , {onDelete:"CASCADE",nullable:true})
  sale: Sale;

  @ManyToOne(() => Purchase, purchase => purchase.payments , {onDelete:"CASCADE",nullable:true})
  purchase: Purchase;


  @ManyToOne(() => Return, returns => returns.payments , { onDelete:"CASCADE" , nullable:true })
  returns:Return;

  @Column()
  amount: number;

  @Column()
  method: string; // cash, card, etc

  @CreateDateColumn()
  date:Date
}