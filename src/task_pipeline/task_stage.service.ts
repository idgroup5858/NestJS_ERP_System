import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTaskStageDto, ReorderTaskStagesDto, UpdateTaskStageDto } from './dto/task-stage.dto';
import { TaskPipeline } from './entities/task_pipeline.entity';
import { TaskStage } from './entities/task_stage.entity';

/** Etap sozlamalari. "На проверке" va "Закрыта" etaplarining turi o'zgarmaydi va o'chirilmaydi. */
@Injectable()
export class TaskStageService {

  constructor(
    @InjectRepository(TaskStage)
    private readonly stages: Repository<TaskStage>,
    @InjectRepository(TaskPipeline)
    private readonly pipelines: Repository<TaskPipeline>,
  ) { }

  private async normalStages(pipelineId: number) {
    return this.stages.find({
      where: { pipeline: { id: pipelineId }, type: 'normal' },
      order: { order_id: 'ASC', id: 'ASC' },
    });
  }

  private async assertNameFree(pipelineId: number, name: string, exceptId?: number) {
    const rows = await this.stages.find({ where: { pipeline: { id: pipelineId } }, select: { id: true, name: true } });
    const taken = rows.some((row) => row.id !== exceptId && row.name.toLowerCase() === name.toLowerCase());
    if (taken) throw new ConflictException('Этап с таким названием уже есть в этой воронке');
  }

  async create(dto: CreateTaskStageDto) {
    const pipeline = await this.pipelines.findOneBy({ id: dto.pipeline_id });
    if (!pipeline) throw new NotFoundException('Воронка не найдена');
    await this.assertNameFree(pipeline.id, dto.name);

    const normal = await this.normalStages(pipeline.id);
    const order = dto.order_id ?? (normal.length ? normal[normal.length - 1].order_id + 1 : 1);

    return this.stages.save(this.stages.create({
      name: dto.name,
      color: dto.color ?? 'neutral',
      type: 'normal',
      order_id: order,
      pipeline,
    }));
  }

  async update(id: number, dto: UpdateTaskStageDto) {
    const stage = await this.stages.findOne({ where: { id }, relations: { pipeline: true } });
    if (!stage) throw new NotFoundException('Этап не найден');

    if (dto.name !== undefined) {
      await this.assertNameFree(stage.pipeline.id, dto.name, id);
      stage.name = dto.name;
    }
    if (dto.color !== undefined) stage.color = dto.color;
    // Tartib faqat oddiy etaplar uchun: review va done doim oxirida turadi.
    if (dto.order_id !== undefined && stage.type === 'normal') stage.order_id = dto.order_id;

    return this.stages.save(stage);
  }

  /** Oddiy etaplarni yangi tartibga soladi. */
  async reorder(dto: ReorderTaskStagesDto) {
    const normal = await this.normalStages(dto.pipeline_id);
    const known = new Set(normal.map((stage) => stage.id));
    const sameSet = dto.ids.length === known.size && dto.ids.every((id) => known.has(id));
    if (!sameSet) throw new BadRequestException('Передайте все обычные этапы воронки, без повторов');

    await this.stages.manager.transaction(async (em) => {
      for (const [index, id] of dto.ids.entries()) {
        await em.update(TaskStage, { id }, { order_id: index + 1 });
      }
    });
    return this.normalStages(dto.pipeline_id);
  }

  async remove(id: number) {
    const stage = await this.stages.createQueryBuilder('s')
      .leftJoinAndSelect('s.pipeline', 'p')
      .loadRelationCountAndMap('s.tasksCount', 's.tasks')
      .where('s.id = :id', { id })
      .getOne() as (TaskStage & { tasksCount: number }) | null;
    if (!stage) throw new NotFoundException('Этап не найден');

    if (stage.type !== 'normal') {
      throw new BadRequestException(`Этап «${stage.name}» обязателен в воронке, его нельзя удалить`);
    }
    if (stage.tasksCount > 0) {
      throw new ConflictException(`В этапе есть задачи (${stage.tasksCount}). Сначала перенесите их в другой этап.`);
    }
    if ((await this.normalStages(stage.pipeline.id)).length <= 1) {
      throw new BadRequestException('В воронке должен остаться хотя бы один обычный этап');
    }

    await this.stages.remove(stage);
    return { message: 'Этап удалён' };
  }
}
