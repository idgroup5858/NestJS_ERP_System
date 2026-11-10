import { Purchase } from "src/purchase/entities/purchase.entity";
import { Return } from "src/return/entities/return.entity";
import { Sale } from "src/sale/entities/sale.entity";
import { SalePaymentItem } from "src/sale/entities/sale-payment-item.entity";
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

  /** Qarz to'lovi aniq tovarlar uchun bo'lsa — qaysi qator, qancha miqdor (bo'sh — umumiy qarzdan). */
  @OneToMany(() => SalePaymentItem, allocation => allocation.payment)
  allocations: SalePaymentItem[];

  @CreateDateColumn()
  date:Date
}