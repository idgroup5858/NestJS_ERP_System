import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { TaskPipelineService } from './task_pipeline.service';
import { CreateTaskPipelineDto } from './dto/create-task_pipeline.dto';
import { UpdateTaskPipelineDto } from './dto/update-task_pipeline.dto';

/** Vazifa jarayonlari (voronkalar). Etaplari `task-stage` da sozlanadi. */
@Controller('task-pipeline')
export class TaskPipelineController {
  constructor(private readonly taskPipelineService: TaskPipelineService) {}

  @Post('add')
  create(@Body() createTaskPipelineDto: CreateTaskPipelineDto) {
    return this.taskPipelineService.create(createTaskPipelineDto);
  }

  /** Barcha jarayonlar etaplari (tartibda) va vazifalar soni bilan. */
  @Get('getall')
  findAll() {
    return this.taskPipelineService.findAll();
  }

  @Get('getby/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.taskPipelineService.findOne(id);
  }

  @Patch('update/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateTaskPipelineDto: UpdateTaskPipelineDto) {
    return this.taskPipelineService.update(id, updateTaskPipelineDto);
  }

  @Delete('delete/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.taskPipelineService.remove(id);
  }
}
