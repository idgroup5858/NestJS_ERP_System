import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskEvent } from './entities/task-event.entity';
import { TaskStage } from 'src/task_pipeline/entities/task_stage.entity';
import { TaskPipeline } from 'src/task_pipeline/entities/task_pipeline.entity';
import { User } from 'src/user/entities/user.entity';
import { Contract } from 'src/contract/entities/contract.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { AttachmentModule } from 'src/attachment/attachment.module';
import { TaskPipelineModule } from 'src/task_pipeline/task_pipeline.module';

@Module({
  imports:[TypeOrmModule.forFeature([Task, TaskEvent, TaskStage, TaskPipeline, User, Contract, Customer]), AttachmentModule, TaskPipelineModule],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
