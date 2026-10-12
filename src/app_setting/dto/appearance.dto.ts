import { IsIn, IsInt, Min } from "class-validator";
import { ACCENTS } from "../appearance";

/** Tizim rangini o'zgartirish (faqat Admin). */
export class UpdateAppearanceDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @IsIn(ACCENTS as readonly string[], { message: `Цвет: ${ACCENTS.join(', ')}` })
    accent: string;
}
