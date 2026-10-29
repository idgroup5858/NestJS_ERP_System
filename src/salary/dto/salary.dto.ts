import { IsInt, Max, Min } from "class-validator";

export class SetSalaryDto {

    @IsInt()
    @Min(1)
    employee_id: number;

    @IsInt({ message: 'Оклад должен быть целым числом' })
    @Min(1, { message: 'Оклад должен быть больше нуля' })
    @Max(2_000_000_000)
    amount: number;
}
