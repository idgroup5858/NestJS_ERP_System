import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class PaySaleItemDto {

    @IsInt()
    sale_item_id: number;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    quantity: number;
}

/**
 * Qarzni aniq tovarlar bo'yicha to'lash: "310 metrdan 10 metri uchun". Summa server hisoblaydi:
 * savdodagi narx, savdo chegirmasi mutanosib (qaytarishdagi qoida bilan bir xil), ko'pi bilan qolgan qarz.
 */
export class PaySaleItemsDto {

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => PaySaleItemDto)
    items: PaySaleItemDto[];

    /** `true` — pul emas, kontragent balansidan ("С баланса"). */
    @IsOptional()
    @IsBoolean()
    from_balance?: boolean;

    /** Pul bilan to'langanda usul; berilmasa — qarz to'lovining odatiy usuli ("В долг"). */
    @IsOptional()
    @IsString()
    @MaxLength(50)
    method?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    user_id?: number;
}
