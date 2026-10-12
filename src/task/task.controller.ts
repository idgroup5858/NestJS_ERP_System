import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { TaskService } from './task.service';
import {
  CreateTaskDto,
  MoveTaskDto,
  TaskActionDto,
  TaskCustomerDto,
  TaskListQueryDto,
  TaskNoteDto,
  UpdateTaskDto,
} from './dto/create-task.dto';

@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /** Vazifa berish mumkin bo'lgan xodimlar (parolsiz). */
  @Get('members')
  members() {
    return this.taskService.members();
  }

  /** Faqat administrator (`user_id`) vazifa ocha oladi. */
  @Post('add')
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.taskService.create(createTaskDto);
  }

  /** Sahifalangan ro'yxat + holat bo'yicha sonlar (summary). */
  @Get('allpagsearch')
  findAllPagSearch(@Query() query: TaskListQueryDto) {
    return this.taskService.findAllPagSearch(query.page ?? 1, query.limit ?? 10, query);
  }

  /** Voronkalar (tablar) bo'yicha vazifalar soni: `{ pipelines: { "<id>": { active, overdue, total } } }`. */
  @Get('pipeline-counts')
  pipelineCounts(@Query() query: TaskListQueryDto) {
    return this.taskService.pipelineCounts(query);
  }

  /** Doska: jarayon etaplari va ulardagi vazifalar. */
  @Get('board')
  board(@Query() query: TaskListQueryDto) {
    return this.taskService.board(query);
  }

  /** `?user_id=` — kim ochmoqda: administratordan boshqasiga faqat o'z vazifasi. */
  @Get('getby/:id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('user_id', new ParseIntPipe({ optional: true })) userId?: number,
  ) {
    return this.taskService.findOneFor(id, userId);
  }

  @Patch('update/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateTaskDto: UpdateTaskDto) {
    return this.taskService.update(id, updateTaskDto);
  }

  /** Kontragent (mijoz) biriktirish: faqat buxgalter va admin; `customer_id: null` — olib tashlaydi. */
  @Patch('customer/:id')
  setCustomer(@Param('id', ParseIntPipe) id: number, @Body() dto: TaskCustomerDto) {
    return this.taskService.setCustomer(id, dto);
  }

  /** Etapdan etapga o'tkazish (doskada surish). */
  @Patch('move/:id')
  move(@Param('id', ParseIntPipe) id: number, @Body() dto: MoveTaskDto) {
    return this.taskService.move(id, dto);
  }

  /** "Yopish" — tekshiruvga yuborish. */
  @Post('submit/:id')
  submit(@Param('id', ParseIntPipe) id: number, @Body() dto: TaskActionDto) {
    return this.taskService.submit(id, dto);
  }

  /** Administrator tasdiqlaydi (yopadi). */
  @Post('approve/:id')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: TaskActionDto) {
    return this.taskService.approve(id, dto);
  }

  /** Administrator sababi bilan qaytaradi. */
  @Post('reject/:id')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: TaskNoteDto) {
    return this.taskService.reject(id, dto);
  }

  @Post('comment/:id')
  comment(@Param('id', ParseIntPipe) id: number, @Body() dto: TaskNoteDto) {
    return this.taskService.comment(id, dto);
  }

  /** Faqat administrator: `?user_id=` — kim o'chirayotgani. */
  @Delete('delete/:id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('user_id', new ParseIntPipe({ optional: true })) userId?: number,
  ) {
    return this.taskService.remove(id, userId);
  }
}
