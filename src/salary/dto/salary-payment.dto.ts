import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { OmitType, PartialType } from "@nestjs/mapped-types";
import { MONTH_PATTERN } from "src/expense/dto/expense.dto";
import { SALARY_PAYMENT_METHODS, SALARY_PAYMENT_TYPES } from "../entities/salary-payment.entity";
import type { SalaryPaymentMethod, SalaryPaymentType } from "../entities/salary-payment.entity";

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSalaryPaymentDto {

    @IsInt()
    @Min(1)
    employee_id: number;

    @Matches(MONTH_PATTERN, { message: 'Месяц должен быть в формате ГГГГ-ММ' })
    month: string;

    @IsInt({ message: 'Сумма должна быть целым числом' })
    @Min(1, { message: 'Сумма должна быть больше нуля' })
    @Max(2_000_000_000)
    amount: number;

    @IsIn(SALARY_PAYMENT_TYPES, { message: 'Тип выплаты: advance | salary' })
    type: SalaryPaymentType;

    // Yuborilmasa — naqd.
    @IsOptional()
    @IsIn(SALARY_PAYMENT_METHODS, { message: 'Способ выплаты: cash | card | transfer' })
    method?: SalaryPaymentMethod;

    // Oyning oklad normasi. Yuborilmasa: shu oyda to'lov bo'lsa — uning normasi, bo'lmasa — joriy oklad.
    // Yuborilsa — shu xodimning shu oydagi barcha to'lovlarida yangilanadi.
    @IsOptional()
    @IsInt({ message: 'Оклад должен быть целым числом' })
    @Min(1, { message: 'Оклад должен быть больше нуля' })
    @Max(2_000_000_000)
    norm?: number;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(1000)
    comment?: string;

    // Kim kiritgan.
    @IsOptional()
    @IsInt()
    @Min(1)
    user_id?: number;
}

/** Xodim va oy o'zgarmaydi: noto'g'ri bo'lsa to'lov o'chirilib, qaytadan kiritiladi. */
export class UpdateSalaryPaymentDto extends PartialType(
    OmitType(CreateSalaryPaymentDto, ['employee_id', 'month', 'user_id'] as const),
) {}
