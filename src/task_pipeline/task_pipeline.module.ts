import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskPipelineService } from './task_pipeline.service';
import { TaskPipelineController } from './task_pipeline.controller';
import { TaskStageController } from './task_stage.controller';
import { TaskStageService } from './task_stage.service';
import { TaskPipeline } from './entities/task_pipeline.entity';
import { TaskStage } from './entities/task_stage.entity';

@Module({
  imports:[TypeOrmModule.forFeature([TaskPipeline, TaskStage])],
  controllers: [TaskPipelineController, TaskStageController],
  providers: [TaskPipelineService, TaskStageService],
  exports: [TaskPipelineService],
})
export class TaskPipelineModule {}
