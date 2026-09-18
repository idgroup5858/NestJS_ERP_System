import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsOptional } from "class-validator";

/**
 * Excel/CSV dan keladigan bitta qator. Kategoriya `id` emas, balki
 * **nomi** bilan keladi — chunki 1C/МойСклад/Bitrix24 eksportlarida
 * shu tizimning id lari boʻlmaydi. Maydonlar ataylab qat'iy
 * tekshirilmaydi: tekshiruv servis ichida qator-baqator bajariladi.
 */
export class ImportProductItemDto {
    name: string;
    barCode: string;
    category: string;
    price: number | string;
    bulkPrice: number | string;
    buyPrice: number | string;
    quantity: number | string;
    unit: string;
}

export class ImportProductDto {

    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(500)
    items: ImportProductItemDto[];

    /** Fayldagi kategoriya bazada boʻlmasa, uni avtomatik yaratish. */
    @IsOptional()
    @IsBoolean()
    createMissingCategories: boolean;

    /** Berilsa, har bir mahsulot shu omborga `quantity` qoldigʻi bilan biriktiriladi. */
    @IsOptional()
    @IsInt()
    warehouseId?: number;
}
