import { Module } from '@nestjs/common';
import { TaskPipelineService } from './task_pipeline.service';
import { TaskPipelineController } from './task_pipeline.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskPipeline } from './entities/task_pipeline.entity';

@Module({
  imports:[TypeOrmModule.forFeature([TaskPipeline])],
  controllers: [TaskPipelineController],
  providers: [TaskPipelineService],
})
export class TaskPipelineModule {}
