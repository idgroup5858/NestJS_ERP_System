import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ExpenseCategoryDto {

    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите название вида расхода' })
    @MaxLength(100)
    name: string;
}
