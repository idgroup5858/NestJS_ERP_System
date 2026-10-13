import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export const OPERATION_TYPES = ['sale', 'return', 'purchase'] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

/** Kontragent bilan bo'lgan operatsiyalar tarixi: tur bo'yicha filtr va sahifalash. */
export class CustomerOperationsQueryDto {

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;

    /** sale — savdolar, return — qaytarishlar, purchase — kontragentdan xaridlar (приход). Yuborilmasa — hammasi. */
    @IsOptional() @IsIn(OPERATION_TYPES) type?: OperationType;
}
