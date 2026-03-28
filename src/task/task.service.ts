import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TaskService {
   constructor(
      @InjectRepository(Task)
      private readonly taskRepository: Repository<Task>
    ) { }
    async create(createTaskDto: CreateTaskDto) {
  
       
      const task = this.taskRepository.create(createTaskDto)
  
      await this.taskRepository.save(task);
      return task;
    }
  
    async findAll() {
  
      return this.taskRepository.find({
       
      });
    }
  
    async findAllPag(page: number, limit: number) {
  
      page = page > 0 ? page : 1;
      limit = limit > 0 ? limit : 10;
  
      const skip = (page - 1) * limit;
  
      const [data, total] = await this.taskRepository.findAndCount({
        skip,
        take: limit,
        order: { id: 'DESC' }, // ixtiyoriy
        //relations: ["sale", "purchase", "returns"]
      });
  
      return {
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        data,
  
      };
  
  
    }
  
    async findOne(id: number) {
  
      const checkTask = await this.taskRepository.findOne({
        where:{id},
         //relations: ["sale", "purchase", "returns"]
        });
      if (!checkTask) throw new NotFoundException("Не найден Задача");
  
      return checkTask;
    }
  
    async update(id: number, updateTaskDto: UpdateTaskDto) {
      const checkTask = await this.taskRepository.findOneBy({ id });
      if (!checkTask) throw new NotFoundException("Не найден Задача");
  
  
  
      const task = await this.taskRepository.preload({
        id,
        ...updateTaskDto
      });
  
      if (!task) throw new NotFoundException()
  
      await this.taskRepository.save(task)
  
      return task;
    }
  
    async remove(id: number) {
      const checkTask = await this.taskRepository.findOneBy({ id });
      if (!checkTask) throw new NotFoundException("Не найден Клиент с таким адресом электронной почты и паролем.");
      await this.taskRepository.remove(checkTask)
      return { message: "Клиент удален" };
    }
}
