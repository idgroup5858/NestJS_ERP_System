import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class ReturnFromSaleItemDto {

    @IsInt()
    sale_item_id: number;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    quantity: number;
}

/** Список продаж ichidan, aniq savdo qatorlari boʻyicha qaytarish. */
export class ReturnFromSaleDto {

    @IsInt()
    sale_id: number;

    @IsOptional()
    @IsInt()
    user_id?: number;

    // Mijozga pul qaytarish usuli. Qaytarish toʻliq qarzdan ayirilsa kerak emas.
    @IsOptional()
    @IsString()
    method?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ReturnFromSaleItemDto)
    items: ReturnFromSaleItemDto[];
}
