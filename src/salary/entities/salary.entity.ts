import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/** Xodimning hozirgi oylik stavkasi (oklad) — har bir xodimga bittadan. */
@Entity()
export class Salary {

    @PrimaryGeneratedColumn()
    id: number;

    // Xodim o'chirilsa okladi ham o'chadi; to'lovlar tarixi esa qoladi (SalaryPayment).
    @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn()
    employee: User;

    @Column()
    amount: number;

    // Oklad qachon belgilangan: undan oldingi oylar vedomostida xodim (to'lovi bo'lmasa) ko'rinmaydi.
    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
