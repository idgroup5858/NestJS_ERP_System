import { Transform } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** "YYYY-MM", oy 01..12. */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CreateExpenseDto {

    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите вид расхода' })
    @MaxLength(100)
    category: string;

    @Matches(MONTH_PATTERN, { message: 'Месяц должен быть в формате ГГГГ-ММ' })
    month: string;

    @IsInt({ message: 'Сумма должна быть целым числом' })
    @Min(1, { message: 'Сумма должна быть больше нуля' })
    @Max(2_000_000_000)
    amount: number;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(1000)
    comment?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    user_id?: number;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
