import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTaskPipelineDto } from './dto/create-task_pipeline.dto';
import { UpdateTaskPipelineDto } from './dto/update-task_pipeline.dto';
import { TaskPipeline } from './entities/task_pipeline.entity';
import { TaskStage } from './entities/task_stage.entity';
import { DEFAULT_PIPELINES, DefaultStage, FALLBACK_STAGES, sortStages } from './task-stages';

@Injectable()
export class TaskPipelineService implements OnModuleInit {

  constructor(
    @InjectRepository(TaskPipeline)
    private readonly pipelines: Repository<TaskPipeline>,
    @InjectRepository(TaskStage)
    private readonly stages: Repository<TaskStage>,
  ) { }

  /** Birinchi ishga tushishda boshlang'ich jarayonlar yaratiladi (admin keyin tahrirlaydi). */
  async onModuleInit() {
    await this.ensureDefaults();
  }

  async ensureDefaults() {
    if ((await this.pipelines.count()) === 0) {
      for (const [index, definition] of DEFAULT_PIPELINES.entries()) {
        await this.createWithStages(definition.name, index + 1, definition.stages, Boolean(definition.forContracts));
      }
      return;
    }

    // Eski, etapsiz voronkalar bo'lsa ham doska ishlashi uchun ularga standart etaplar beriladi.
    const empty = await this.pipelines.createQueryBuilder('p')
      .leftJoin('p.stages', 's')
      .where('s.id IS NULL')
      .getMany();
    for (const pipeline of empty) await this.addStages(pipeline, FALLBACK_STAGES);

    await this.ensureContractPipeline();
  }

  /**
   * Shartnoma vazifalari tushadigan voronka (`forContracts`). Belgilangani bo'lmasa: "По договору" nomlisi
   * belgilanadi, u ham bo'lmasa standart "По договору" voronkasi yaratiladi. Hech qachon oddiy
   * ("Обычная задача") voronkaga ketmaydi.
   */
  async ensureContractPipeline(): Promise<TaskPipeline> {
    const flagged = await this.pipelines.findOne({ where: { forContracts: true }, order: { order_id: 'ASC', id: 'ASC' } });
    if (flagged) return flagged;

    const byName = await this.pipelines.findOne({ where: { name: 'По договору' } });
    if (byName) {
      byName.forContracts = true;
      return this.pipelines.save(byName);
    }

    const definition = DEFAULT_PIPELINES.find((item) => item.forContracts) ?? DEFAULT_PIPELINES[0];
    const last = await this.pipelines.createQueryBuilder('p').select('MAX(p.order_id)', 'max').getRawOne<{ max: number | null }>();
    return this.createWithStages(definition.name, (last?.max ?? 0) + 1, definition.stages, true);
  }

  private async addStages(pipeline: TaskPipeline, definitions: DefaultStage[]) {
    await this.stages.save(definitions.map((definition, index) => this.stages.create({
      ...definition,
      order_id: index + 1,
      pipeline,
    })));
  }

  private async createWithStages(name: string, order: number, definitions: DefaultStage[], forContracts = false) {
    const pipeline = await this.pipelines.save(this.pipelines.create({ name, order_id: order, forContracts }));
    await this.addStages(pipeline, definitions);
    return pipeline;
  }

  /** Jarayonlar etaplari (tartibda) va vazifalar soni bilan. */
  async findAll() {
    const pipelines = await this.pipelines.createQueryBuilder('p')
      .leftJoinAndSelect('p.stages', 's')
      .loadRelationCountAndMap('p.tasksCount', 'p.tasks')
      .loadRelationCountAndMap('s.tasksCount', 's.tasks')
      .orderBy('p.order_id', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .getMany();

    return pipelines.map((pipeline) => ({ ...pipeline, stages: sortStages(pipeline.stages) }));
  }

  async findOne(id: number) {
    const pipeline = await this.pipelines.createQueryBuilder('p')
      .leftJoinAndSelect('p.stages', 's')
      .loadRelationCountAndMap('p.tasksCount', 'p.tasks')
      .loadRelationCountAndMap('s.tasksCount', 's.tasks')
      .where('p.id = :id', { id })
      .getOne();
    if (!pipeline) throw new NotFoundException('Воронка не найдена');
    return { ...pipeline, stages: sortStages(pipeline.stages) };
  }

  private async assertNameFree(name: string, exceptId?: number) {
    const rows = await this.pipelines.find({ select: { id: true, name: true } });
    const taken = rows.some((row) => row.id !== exceptId && row.name.toLowerCase() === name.toLowerCase());
    if (taken) throw new ConflictException('Воронка с таким названием уже есть');
  }

  async create(dto: CreateTaskPipelineDto) {
    await this.assertNameFree(dto.name);
    const last = await this.pipelines.createQueryBuilder('p').select('MAX(p.order_id)', 'max').getRawOne<{ max: number | null }>();
    const pipeline = await this.createWithStages(dto.name, (last?.max ?? 0) + 1, DEFAULT_PIPELINES[0].stages);
    return this.findOne(pipeline.id);
  }

  async update(id: number, dto: UpdateTaskPipelineDto) {
    const pipeline = await this.pipelines.findOneBy({ id });
    if (!pipeline) throw new NotFoundException('Воронка не найдена');

    if (dto.name !== undefined) {
      await this.assertNameFree(dto.name, id);
      pipeline.name = dto.name;
    }
    if (dto.order_id !== undefined) pipeline.order_id = dto.order_id;

    if (dto.forContracts !== undefined && dto.forContracts !== pipeline.forContracts) {
      if (!dto.forContracts) {
        throw new BadRequestException('Воронка для договоров всегда должна быть: отметьте для этого другую воронку');
      }
      // Belgi bitta voronkada: avvalgisidan olinadi.
      await this.pipelines.update({ forContracts: true }, { forContracts: false });
      pipeline.forContracts = true;
    }
    await this.pipelines.save(pipeline);

    return this.findOne(id);
  }

  async remove(id: number) {
    const pipeline = await this.pipelines.createQueryBuilder('p')
      .loadRelationCountAndMap('p.tasksCount', 'p.tasks')
      .where('p.id = :id', { id })
      .getOne() as (TaskPipeline & { tasksCount: number }) | null;
    if (!pipeline) throw new NotFoundException('Воронка не найдена');
    if (pipeline.forContracts) {
      throw new ConflictException('Это воронка для договоров: сначала отметьте для договоров другую воронку.');
    }
    if (pipeline.tasksCount > 0) {
      throw new ConflictException(`В воронке есть задачи (${pipeline.tasksCount}). Сначала удалите или перенесите их.`);
    }

    await this.pipelines.remove(pipeline);
    return { message: 'Воронка удалена' };
  }
}
