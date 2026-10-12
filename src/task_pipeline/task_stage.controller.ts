import { Body, Controller, Delete, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateTaskStageDto, ReorderTaskStagesDto, UpdateTaskStageDto } from './dto/task-stage.dto';
import { TaskStageService } from './task_stage.service';

/** Jarayon etaplari (doskadagi ustunlar). */
@Controller('task-stage')
export class TaskStageController {
  constructor(private readonly stageService: TaskStageService) { }

  @Post('add')
  create(@Body() dto: CreateTaskStageDto) {
    return this.stageService.create(dto);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderTaskStagesDto) {
    return this.stageService.reorder(dto);
  }

  @Patch('update/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskStageDto) {
    return this.stageService.update(id, dto);
  }

  @Delete('delete/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.stageService.remove(id);
  }
}
