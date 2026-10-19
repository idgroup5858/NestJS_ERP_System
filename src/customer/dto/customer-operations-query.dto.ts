import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export const OPERATION_TYPES = ['sale', 'return', 'purchase'] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

/** Bir sahifadagi operatsiyalar soni chegarasi: kartochkada 10 / 50 / 100 yoki o'z qiymati tanlanadi. */
export const OPERATIONS_MAX_LIMIT = 500;

/** Kontragent bilan bo'lgan operatsiyalar tarixi: tur bo'yicha filtr va sahifalash. */
export class CustomerOperationsQueryDto {

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(OPERATIONS_MAX_LIMIT) limit?: number;

    /** sale — savdolar, return — qaytarishlar, purchase — kontragentdan xaridlar (приход). Yuborilmasa — hammasi. */
    @IsOptional() @IsIn(OPERATION_TYPES) type?: OperationType;

    /** `true` / `1` — faqat qarzi qolgan savdolar (`type` e'tiborga olinmaydi). */
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true' || value === '1')
    @IsBoolean()
    debt?: boolean;
}
