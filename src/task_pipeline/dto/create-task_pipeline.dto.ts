import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTaskPipelineDto {

    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите название воронки' })
    @MaxLength(100)
    name: string;
}
