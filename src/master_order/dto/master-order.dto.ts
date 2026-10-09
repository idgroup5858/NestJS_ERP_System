import { Type } from "class-transformer";
import {
    ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional,
    IsString, IsUrl, Max, MaxLength, Min, ValidateIf, ValidateNested
} from "class-validator";

export class MasterOrderItemDto {

    @IsInt()
    @Min(1)
    product_id: number;

    // Metr/kg kabi o'nli birliklar uchun 3 xonagacha.
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    @Max(99999999)
    quantity: number;

    @IsIn(['retail', 'bulk'])
    priceType: 'retail' | 'bulk';
}

/** Zakaz yaratish va (holati "yangi" bo'lganda) to'liq qayta yozish uchun. */
export class CreateMasterOrderDto {

    // Hozircha usta id si so'rovdan keladi; autentifikatsiya qo'shilganda tokendan olinadi.
    @IsInt()
    @Min(1)
    master_id: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    customerName: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(32)
    customerPhone: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;

    // Faqat http(s): admin panelda havola sifatida ochiladi, `javascript:` kabilar o'tmasligi kerak.
    @ValidateIf(o => o.mapUrl)
    @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
    @MaxLength(1000)
    mapUrl?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    serviceFee?: number;

    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => MasterOrderItemDto)
    items: MasterOrderItemDto[];
}

export class CancelMasterOrderDto {

    @IsInt()
    @Min(1)
    master_id: number;
}

export class SetMasterOrderStatusDto {

    @IsIn(['preparing', 'ready', 'cancelled'])
    status: 'preparing' | 'ready' | 'cancelled';
}

export class CompleteMasterOrderDto {

    @IsInt()
    @Min(1)
    sale_id: number;
}
