import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Telegram } from "./telegram.entity";

/** Botga ulanish havolasi orqali kirgan chat (shaxsiy yoki guruh) — xabarlar shu yerga boradi. */
@Entity()
@Unique(['bot', 'chatId'])
export class TelegramChat {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Telegram, bot => bot.chats, { onDelete: "CASCADE" })
    bot: Telegram;

    // Telegram chat id int32 ga sigʻmaydi (guruhlarda manfiy va katta).
    @Column({ type: 'bigint' })
    chatId: string;

    @Column({ nullable: true })
    title: string;

    @Column({ nullable: true })
    username: string;

    @CreateDateColumn()
    date: Date;
}
