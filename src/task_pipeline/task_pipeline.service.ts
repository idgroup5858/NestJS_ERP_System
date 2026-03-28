import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskPipelineDto } from './dto/create-task_pipeline.dto';
import { UpdateTaskPipelineDto } from './dto/update-task_pipeline.dto';
import { UpdateCustomerDto } from 'src/customer/dto/update-customer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { TaskPipeline } from './entities/task_pipeline.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TaskPipelineService {
  constructor(
     @InjectRepository(TaskPipeline)
     private readonly task_pipelineRepsitory: Repository<TaskPipeline>
   ) { }
   async create(createTaskPipelineDto: CreateTaskPipelineDto) {
 
     const pipeline = this.task_pipelineRepsitory.create(createTaskPipelineDto)
 
     await this.task_pipelineRepsitory.save(pipeline);
     return pipeline;
   }
 
   async findAll() {
 
     return this.task_pipelineRepsitory.find({
      
     });
   }
 
   async findAllPag(page: number, limit: number) {
 
     page = page > 0 ? page : 1;
     limit = limit > 0 ? limit : 10;
 
     const skip = (page - 1) * limit;
 
     const [data, total] = await this.task_pipelineRepsitory.findAndCount({
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
 
     const checkPipeline = await this.task_pipelineRepsitory.findOne({
       where:{id},
        //relations: ["sale", "purchase", "returns"]
       });
     if (!checkPipeline) throw new NotFoundException("Не найден Варонка.");
 
     return checkPipeline;
   }
 
   async update(id: number, updateTaskPipelineDto: UpdateTaskPipelineDto) {
     const checkPipeline = await this.task_pipelineRepsitory.findOneBy({ id });
     if (!checkPipeline) throw new NotFoundException("Не найден Варонка.");
 
 
     const pipeline = await this.task_pipelineRepsitory.preload({
       id,
       ...updateTaskPipelineDto
     });
 
     if (!pipeline) throw new NotFoundException()
 
     await this.task_pipelineRepsitory.save(pipeline)
 
     return pipeline;
   }
 
   async remove(id: number) {
     const checkPipeline = await this.task_pipelineRepsitory.findOneBy({ id });
      if (!checkPipeline) throw new NotFoundException("Не найден Варонка.");
     await this.task_pipelineRepsitory.remove(checkPipeline)
     return { message: "Варонка удален" };
   }
}
