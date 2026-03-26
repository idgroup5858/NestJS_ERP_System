import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskPipelineDto } from './create-task_pipeline.dto';

export class UpdateTaskPipelineDto extends PartialType(CreateTaskPipelineDto) {}
