import { Module } from '@nestjs/common';
import { TaskPipelineService } from './task_pipeline.service';
import { TaskPipelineController } from './task_pipeline.controller';

@Module({
  controllers: [TaskPipelineController],
  providers: [TaskPipelineService],
})
export class TaskPipelineModule {}
