import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateTelegramDto {

    // Boʻsh qolsa — Telegram dagi bot nomi olinadi.
    @IsOptional()
    @IsString()
    botName?: string;

    @IsString()
    @IsNotEmpty()
    botToken: string;
}
