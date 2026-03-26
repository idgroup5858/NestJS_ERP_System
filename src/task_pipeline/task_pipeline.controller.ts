import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TaskPipelineService } from './task_pipeline.service';
import { CreateTaskPipelineDto } from './dto/create-task_pipeline.dto';
import { UpdateTaskPipelineDto } from './dto/update-task_pipeline.dto';

@Controller('task-pipeline')
export class TaskPipelineController {
  constructor(private readonly taskPipelineService: TaskPipelineService) {}

  @Post()
  create(@Body() createTaskPipelineDto: CreateTaskPipelineDto) {
    return this.taskPipelineService.create(createTaskPipelineDto);
  }

  @Get()
  findAll() {
    return this.taskPipelineService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.taskPipelineService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskPipelineDto: UpdateTaskPipelineDto) {
    return this.taskPipelineService.update(+id, updateTaskPipelineDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.taskPipelineService.remove(+id);
  }
}
