import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, Min } from "class-validator";
import { CreateTaskPipelineDto } from './create-task_pipeline.dto';

export class UpdateTaskPipelineDto extends PartialType(CreateTaskPipelineDto) {

    /** Jarayonlar ro'yxatidagi o'rni. */
    @IsOptional()
    @IsInt()
    @Min(0)
    order_id?: number;
}
