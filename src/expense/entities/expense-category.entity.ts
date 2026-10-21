import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * Xarajat turi (UI dagi ro'yxat). Xarajat turga nomi bilan bog'langan (`Expense.category`),
 * shuning uchun tur qayta nomlansa yoki o'chirilsa, uning xarajatlari ham birga yangilanadi.
 */
@Entity()
export class ExpenseCategory {

    @PrimaryGeneratedColumn()
    id: number;

    @Index({ unique: true })
    @Column({ length: 100 })
    name: string;

    @CreateDateColumn()
    createdAt: Date;
}
