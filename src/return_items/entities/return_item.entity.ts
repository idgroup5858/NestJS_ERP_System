import { QUANTITY_COLUMN } from "src/common/quantity";
import { Product } from "src/product/entities/product.entity";
import { Purchase } from "src/purchase/entities/purchase.entity";
import { Return } from "src/return/entities/return.entity";
import { SaleItem } from "src/sale_items/entities/sale_item.entity";
import { Warehouse } from "src/warehouse/entities/warehouse.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";



@Entity()
export class ReturnItem {


    @PrimaryGeneratedColumn()
    id: number;


    @ManyToOne(() => Return, returns => returns.items, { onDelete: "CASCADE" })
    returns: Return;

    @ManyToOne(() => Product)
    product: Product;

    @ManyToOne(() => Warehouse)
    warehouse: Warehouse;

    // Qaysi savdo qatoridan qaytarilgan — bitta qatorni sotilganidan
    // koʻp qaytarib boʻlmasligi shu orqali tekshiriladi.
    @ManyToOne(() => SaleItem, saleItem => saleItem.returnItems, { nullable: true, onDelete: "SET NULL" })
    saleItem: SaleItem;

    @Column(QUANTITY_COLUMN)
    quantity: number;

    @Column()
    price: number;

    @Column({ default: false })
    checkPrice: boolean;

    @CreateDateColumn()
    date: Date;
}
