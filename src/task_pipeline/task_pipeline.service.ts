import { Injectable } from '@nestjs/common';
import { CreateTaskPipelineDto } from './dto/create-task_pipeline.dto';
import { UpdateTaskPipelineDto } from './dto/update-task_pipeline.dto';

@Injectable()
export class TaskPipelineService {
  create(createTaskPipelineDto: CreateTaskPipelineDto) {
    return 'This action adds a new taskPipeline';
  }

  findAll() {
    return `This action returns all taskPipeline`;
  }

  findOne(id: number) {
    return `This action returns a #${id} taskPipeline`;
  }

  update(id: number, updateTaskPipelineDto: UpdateTaskPipelineDto) {
    return `This action updates a #${id} taskPipeline`;
  }

  remove(id: number) {
    return `This action removes a #${id} taskPipeline`;
  }
}
