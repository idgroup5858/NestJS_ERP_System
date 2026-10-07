import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { TelegramChat } from "./telegram-chat.entity";


@Entity()
export class Telegram {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    botName:string;
    @Column()
    botToken:string;

    // Botning @username i — qoʻshishda Telegram (getMe) dan olinadi.
    @Column({ nullable: true })
    username: string;

    // Ulanish havolasidagi maxfiy kod (t.me/<bot>?start=<kod>). Botga faqat
    // shu havola orqali kirganlar savdo maʼlumotlarini oladi.
    @Column({ nullable: true })
    connectCode: string;

    @OneToMany(() => TelegramChat, chat => chat.bot)
    chats: TelegramChat[];

    @OneToMany(() => User, user => user.telegram)
    user:User[];

    @CreateDateColumn()
    date: Date;
    


}
