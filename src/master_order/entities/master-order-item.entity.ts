import { QUANTITY_COLUMN } from "src/common/quantity";
import { Product } from "src/product/entities/product.entity";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { MasterOrder } from "./master-order.entity";

export type MasterOrderPriceType = 'retail' | 'bulk';

@Entity()
export class MasterOrderItem {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => MasterOrder, order => order.items, { onDelete: "CASCADE" })
    order: MasterOrder;

    @ManyToOne(() => Product, { nullable: false })
    product: Product;

    @Column(QUANTITY_COLUMN)
    quantity: number;

    @Column({ type: 'varchar', length: 10 })
    priceType: MasterOrderPriceType;

    // Zakaz berilgan paytdagi narx: keyin mahsulot narxi o'zgarsa ham usta ko'rgan narx saqlanadi.
    @Column()
    price: number;
}
