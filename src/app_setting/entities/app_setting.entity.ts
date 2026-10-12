import { User } from "src/user/entities/user.entity";
import { Column, Entity, ManyToOne, PrimaryColumn, UpdateDateColumn } from "typeorm";

/**
 * Umumiy sozlamalar: kalit -> JSON qiymat. Hozircha bitta kalit bor — `menu_access`
 * (chap menyudagi bo'limlarni rollar bo'yicha ko'rsatish/yashirish).
 */
@Entity('app_setting')
export class AppSetting {

    @PrimaryColumn({ type: 'varchar', length: 60 })
    key: string;

    @Column({ type: 'jsonb' })
    value: Record<string, unknown>;

    /** Oxirgi o'zgartirgan administrator. */
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    updatedBy: User | null;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}
