import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { AttachmentService } from 'src/attachment/attachment.service';
import { Contract } from 'src/contract/entities/contract.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { TaskPipeline } from 'src/task_pipeline/entities/task_pipeline.entity';
import { TaskStage } from 'src/task_pipeline/entities/task_stage.entity';
import { sortStages, taskState } from 'src/task_pipeline/task-stages';
import { User } from 'src/user/entities/user.entity';
import {
  CreateTaskDto,
  MoveTaskDto,
  TaskActionDto,
  TaskCustomerDto,
  TaskListQueryDto,
  TaskNoteDto,
  UpdateTaskDto,
} from './dto/create-task.dto';
import { TaskEvent, TaskEventType } from './entities/task-event.entity';
import { Task } from './entities/task.entity';

const MAX_LIMIT = 100;

/** Doskada "Закрыта" ustunida eng oxirgi nechta yopilgan vazifa ko'rsatiladi (qolganlari — ro'yxatda). */
const DONE_ON_BOARD = 30;

export interface UserBrief {
  id: number;
  username: string;
  surname: string;
}

/** Foydalanuvchining faqat ko'rsatiladigan maydonlari (parol xeshi hech qachon chiqmaydi). */
const brief = (user?: User | null): UserBrief | null =>
  user ? { id: user.id, username: user.username, surname: user.surname } : null;

const fullName = (user?: User | null) => (user ? `${user.username} ${user.surname}`.trim() : '—');

const customerName = (customer?: Customer | null) =>
  customer ? `${customer.username} ${customer.surname}`.trim() : '—';

/** Kontragent biriktira oladigan rollar. */
const canAttachCustomer = (user?: User | null) => {
  const role = user?.role?.trim().toLowerCase();
  return role === 'admin' || role === 'accountant';
};

const isAdmin = (user?: User | null) => user?.role?.trim().toLowerCase() === 'admin';

/**
 * Muddati o'tgan: oddiy etapda — muddat o'tib ketgan; tekshiruvda — vazifa muddatdan KEYIN
 * yuborilgan (o'z vaqtida yuborilgan vazifani admin kech ko'rsa, ijrochi aybdor emas).
 */
const OVERDUE_SQL =
  `((st.type = 'normal' AND t.dueDate < NOW()) OR ` +
  `(st.type = 'review' AND t.dueDate IS NOT NULL AND t.submittedAt > t.dueDate))`;

/** Vazifaga aloqador xodim: javobgar, ishtirokchi yoki uni ochgan odam (`:memberId`). */
const MEMBER_SQL =
  `(rs.id = :memberId OR cr.id = :memberId OR EXISTS ` +
  `(SELECT 1 FROM task_participants tp WHERE tp."taskId" = t.id AND tp."userId" = :memberId))`;

const NEWEST_FIRST_BY_DUE = (query: SelectQueryBuilder<Task>) =>
  query.orderBy('t.dueDate', 'ASC', 'NULLS LAST').addOrderBy('t.id', 'DESC');

interface TimedTask {
  stage?: { type: 'normal' | 'review' | 'done' } | null;
  dueDate: Date | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
}

/**
 * Muddat belgilari (saqlanmaydi, har safar hisoblanadi):
 *  - overdue: oddiy etapda — muddat o'tib ketgan; tekshiruvda — vazifa muddatdan KEYIN yuborilgan;
 *  - closedLate: yopilgan vazifa muddatdan keyin yakunlanganmi (yopilmaganlar uchun null).
 * Shartnoma kartochkasi ham shuni ishlatadi.
 */
export function taskTiming(task: TimedTask, now = Date.now()) {
  const type = task.stage?.type ?? 'normal';
  const due = task.dueDate ? task.dueDate.getTime() : null;
  const submitted = task.submittedAt ? task.submittedAt.getTime() : null;
  const approved = task.approvedAt ? task.approvedAt.getTime() : null;

  let overdue = false;
  let closedLate: boolean | null = null;
  if (due !== null) {
    if (type === 'normal') overdue = now > due;
    else if (type === 'review') overdue = (submitted ?? now) > due;
    else closedLate = (submitted ?? approved ?? now) > due;
  }
  return { overdue, closedLate };
}

@Injectable()
export class TaskService {

  constructor(
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(TaskEvent)
    private readonly events: Repository<TaskEvent>,
    @InjectRepository(TaskStage)
    private readonly stages: Repository<TaskStage>,
    @InjectRepository(TaskPipeline)
    private readonly pipelines: Repository<TaskPipeline>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    private readonly files: AttachmentService,
  ) { }

  // ------------------------------------------------------------------ yordamchilar

  private async requireUser(id: number) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException(`Пользователь #${id} не найден`);
    return user;
  }

  /**
   * Kim so'rayapti. Autentifikatsiya qo'shilguncha `user_id` orqali aniqlanadi
   * (keyin tokendan olinadi, qolgan mantiq o'zgarmaydi).
   */
  private async requireActor(userId?: number) {
    if (!userId) throw new BadRequestException('Укажите user_id — пользователя, который выполняет запрос');
    return this.requireUser(userId);
  }

  /** Administrator hammasini ko'radi; qolganlar faqat o'ziga tegishli vazifalarni. */
  private async scoped(filter: TaskListQueryDto): Promise<TaskListQueryDto> {
    const actor = await this.requireActor(filter.user_id);
    return isAdmin(actor) ? filter : { ...filter, member_id: actor.id };
  }

  /** Administrator bo'lmagan xodim faqat o'ziga tegishli vazifani ochishi va o'zgartirishi mumkin. */
  private async assertAccess(taskId: number, actor: User) {
    if (isAdmin(actor)) return;

    const allowed = await this.lightQuery()
      .where('t.id = :id', { id: taskId })
      .andWhere(MEMBER_SQL, { memberId: actor.id })
      .getCount();
    if (allowed) return;

    if (!(await this.tasks.existsBy({ id: taskId }))) throw new NotFoundException('Задача не найдена');
    throw new ForbiddenException('Эта задача вам не назначена');
  }

  private async requireContract(id: number) {
    const contract = await this.contracts.findOneBy({ id });
    if (!contract) throw new NotFoundException('Договор не найден');
    return contract;
  }

  private async requireCustomer(id: number) {
    const customer = await this.customers.findOneBy({ id });
    if (!customer) throw new NotFoundException('Контрагент не найден');
    return customer;
  }

  private async participantsOf(ids: number[] | undefined, responsibleId?: number | null) {
    const unique = [...new Set(ids ?? [])].filter((id) => id !== responsibleId);
    if (unique.length === 0) return [];
    const found = await this.users.find({ where: { id: In(unique) } });
    const missing = unique.filter((id) => !found.some((user) => user.id === id));
    if (missing.length) throw new BadRequestException(`Пользователь #${missing[0]} не найден`);
    return found;
  }

  /** Filtr uchun yetarli yengil so'rov (faqat many-to-one bog'lanishlar, qatorlar ko'paymaydi). */
  private lightQuery() {
    return this.tasks.createQueryBuilder('t')
      .leftJoin('t.pipeline', 'pl')
      .leftJoin('t.stage', 'st')
      .leftJoin('t.creator', 'cr')
      .leftJoin('t.responsible', 'rs')
      .leftJoin('t.contract', 'ct')
      .leftJoin('t.customer', 'cu');
  }

  private fullQuery() {
    return this.lightQuery()
      .leftJoin('t.submittedBy', 'sb')
      .leftJoin('t.approvedBy', 'ab')
      .leftJoin('t.participants', 'pt')
      .addSelect(['pl.id', 'pl.name'])
      .addSelect(['st.id', 'st.name', 'st.color', 'st.type', 'st.order_id'])
      .addSelect(['cr.id', 'cr.username', 'cr.surname'])
      .addSelect(['rs.id', 'rs.username', 'rs.surname'])
      .addSelect(['sb.id', 'sb.username', 'sb.surname'])
      .addSelect(['ab.id', 'ab.username', 'ab.surname'])
      .addSelect(['pt.id', 'pt.username', 'pt.surname'])
      .addSelect(['ct.id', 'ct.number', 'ct.subject', 'ct.status'])
      .addSelect(['cu.id', 'cu.username', 'cu.surname', 'cu.phone'])
      .loadRelationCountAndMap('t.attachmentsCount', 't.attachments');
  }

  private applyFilter(query: SelectQueryBuilder<Task>, f: TaskListQueryDto) {
    if (f.pipeline_id) query.andWhere('pl.id = :pipelineId', { pipelineId: f.pipeline_id });
    if (f.stage_id) query.andWhere('st.id = :stageId', { stageId: f.stage_id });
    if (f.state) query.andWhere('st.type = :type', { type: f.state === 'open' ? 'normal' : f.state });
    if (f.responsible_id) query.andWhere('rs.id = :responsibleId', { responsibleId: f.responsible_id });
    if (f.creator_id) query.andWhere('cr.id = :creatorId', { creatorId: f.creator_id });
    if (f.contract_id) query.andWhere('ct.id = :contractId', { contractId: f.contract_id });
    if (f.with_contract) query.andWhere('ct.id IS NOT NULL');
    if (f.member_id) query.andWhere(MEMBER_SQL, { memberId: f.member_id });
    if (f.overdue) query.andWhere(OVERDUE_SQL);
    if (f.search?.trim()) {
      query.andWhere('(t.title ILIKE :search OR t.description ILIKE :search)', { search: `%${f.search.trim()}%` });
    }
    return query;
  }

  /** Mijoz uchun ko'rinish: holat va "muddati o'tgan" belgisi shu yerda hisoblanadi (saqlanmaydi). */
  private toView(task: Task & { attachmentsCount?: number }, now = Date.now()) {
    const { overdue, closedLate } = taskTiming(task, now);

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      pipeline: task.pipeline ? { id: task.pipeline.id, name: task.pipeline.name } : null,
      stage: task.stage
        ? { id: task.stage.id, name: task.stage.name, color: task.stage.color, type: task.stage.type, order_id: task.stage.order_id }
        : null,
      state: taskState(task.stage?.type),
      contract: task.contract
        ? { id: task.contract.id, number: task.contract.number, subject: task.contract.subject, status: task.contract.status }
        : null,
      customer: task.customer
        ? { id: task.customer.id, username: task.customer.username, surname: task.customer.surname, phone: task.customer.phone }
        : null,
      attachmentsCount: task.attachmentsCount ?? 0,
      creator: brief(task.creator),
      responsible: brief(task.responsible),
      participants: (task.participants ?? []).map((user) => brief(user)),
      dueDate: task.dueDate,
      submittedBy: brief(task.submittedBy),
      submittedAt: task.submittedAt,
      approvedBy: brief(task.approvedBy),
      approvedAt: task.approvedAt,
      overdue,
      closedLate,
      date: task.date,
      updatedAt: task.updatedAt,
    };
  }

  private async log(
    em: EntityManager,
    task: Task,
    user: User | null,
    type: TaskEventType,
    extra: { fromStage?: string | null; toStage?: string | null; note?: string | null } = {},
  ) {
    await em.save(em.create(TaskEvent, {
      task,
      user,
      type,
      fromStage: extra.fromStage ?? null,
      toStage: extra.toStage ?? null,
      note: extra.note ?? null,
    }));
  }

  // ------------------------------------------------------------------ yaratish va o'qish
  /**
   * Vazifa berish mumkin bo'lgan xodimlar (tanlagichlar uchun). Faqat id, ism va rol —
   * parol xeshi chiqmaydi. Mobil ilovadagi ustalar (Master) vazifa olmaydi.
   */
  async members() {
    const rows = await this.users.find({
      select: { id: true, username: true, surname: true, role: true },
      order: { username: 'ASC', id: 'ASC' },
    });
    return rows
      .filter((user) => user.role?.trim().toLowerCase() !== 'master')
      .map((user) => ({ id: user.id, username: user.username, surname: user.surname, role: user.role }));
  }


  async create(dto: CreateTaskDto) {
    const creator = await this.requireUser(dto.user_id);
    if (!isAdmin(creator)) throw new ForbiddenException('Создавать задачи может только администратор');

    const pipeline = await this.pipelines.findOneBy({ id: dto.pipeline_id });
    if (!pipeline) throw new NotFoundException('Воронка не найдена');

    const stages = sortStages(await this.stages.find({ where: { pipeline: { id: pipeline.id } } }));
    let stage: TaskStage | undefined;
    if (dto.stage_id) {
      stage = stages.find((item) => item.id === dto.stage_id);
      if (!stage) throw new BadRequestException('Этап не относится к этой воронке');
      if (stage.type !== 'normal') {
        throw new BadRequestException('Новую задачу нельзя создать на этапе проверки или закрытия');
      }
    } else {
      stage = stages.find((item) => item.type === 'normal');
    }
    if (!stage) throw new BadRequestException('В воронке нет этапов');

    const responsible = dto.responsible_id ? await this.requireUser(dto.responsible_id) : null;
    const participants = await this.participantsOf(dto.participant_ids, responsible?.id);
    const contract = dto.contract_id ? await this.requireContract(dto.contract_id) : null;
    const customer = dto.customer_id ? await this.requireCustomer(dto.customer_id) : null;

    const saved = await this.tasks.manager.transaction(async (em) => {
      const task = await em.save(em.create(Task, {
        title: dto.title,
        description: dto.description ?? '',
        priority: dto.priority ?? 'normal',
        pipeline,
        stage,
        creator,
        responsible,
        participants,
        contract,
        customer,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      }));
      await this.log(em, task, creator, 'created', { toStage: stage.name });
      return task;
    });

    return this.findOne(saved.id);
  }

  async findOne(id: number) {
    const task = await this.fullQuery().where('t.id = :id', { id }).getOne();
    if (!task) throw new NotFoundException('Задача не найдена');

    const events = await this.events.createQueryBuilder('e')
      .innerJoin('e.task', 'tk')
      .leftJoin('e.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.surname'])
      .where('tk.id = :id', { id })
      .orderBy('e.createdAt', 'ASC')
      .addOrderBy('e.id', 'ASC')
      .getMany();

    return {
      ...this.toView(task),
      files: await this.files.listFor({ task_id: id }),
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        user: brief(event.user),
        fromStage: event.fromStage,
        toStage: event.toStage,
        note: event.note,
        createdAt: event.createdAt,
      })),
    };
  }

  /** Kartochka: administratorga har qanday, qolganlarga faqat o'zining vazifasi. */
  async findOneFor(id: number, userId?: number) {
    const actor = await this.requireActor(userId);
    await this.assertAccess(id, actor);
    return this.findOne(id);
  }

  async findAllPagSearch(page: number, limit: number, requested: TaskListQueryDto) {
    const filter = await this.scoped(requested);
    page = page > 0 ? page : 1;
    limit = limit > 0 ? Math.min(limit, MAX_LIMIT) : 10;

    const [rows, total] = await NEWEST_FIRST_BY_DUE(this.applyFilter(this.fullQuery(), filter))
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Holat bo'yicha sonlar: state/overdue filtrisiz (tugmalardagi hisoblagichlar uchun).
    const base: TaskListQueryDto = { ...filter, state: undefined, overdue: undefined };
    const summary = await this.applyFilter(this.lightQuery(), base)
      .select(`COUNT(*) FILTER (WHERE st.type = 'normal')`, 'open')
      .addSelect(`COUNT(*) FILTER (WHERE st.type = 'review')`, 'review')
      .addSelect(`COUNT(*) FILTER (WHERE st.type = 'done')`, 'done')
      .addSelect(`COUNT(*) FILTER (WHERE ${OVERDUE_SQL})`, 'overdue')
      .getRawOne<{ open: string; review: string; done: string; overdue: string }>();

    // Etap bo'yicha sonlar (ro'yxatdagi etap tugmalari): tanlangan etap/holatdan tashqari barcha filtrlar bilan.
    const perStage = await this.applyFilter(this.lightQuery(), { ...filter, stage_id: undefined, state: undefined })
      .select('st.id', 'stageId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('st.id')
      .getRawMany<{ stageId: number | null; count: string }>();
    const stageCounts: Record<number, number> = {};
    for (const row of perStage) {
      if (row.stageId !== null) stageCounts[Number(row.stageId)] = Number(row.count);
    }

    const now = Date.now();
    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        open: Number(summary?.open ?? 0),
        review: Number(summary?.review ?? 0),
        done: Number(summary?.done ?? 0),
        overdue: Number(summary?.overdue ?? 0),
      },
      stageCounts,
      data: rows.map((task) => this.toView(task, now)),
    };
  }

  /**
   * Har bir voronka (tab) bo'yicha foydalanuvchiga ko'rinadigan vazifalar soni: faol (yopilmagan),
   * muddati o'tgan va jami. Qolgan filtrlar (qidiruv, javobgar, "только просроченные") hisobga olinadi,
   * voronka/etap/holat filtrlari esa yo'q — tablardagi sonlar shu uchun.
   */
  async pipelineCounts(requested: TaskListQueryDto) {
    const filter = await this.scoped(requested);
    const rows = await this.applyFilter(this.lightQuery(), {
      ...filter,
      pipeline_id: undefined,
      stage_id: undefined,
      state: undefined,
    })
      .select('pl.id', 'pipelineId')
      .addSelect(`COUNT(*) FILTER (WHERE st.type <> 'done')`, 'active')
      .addSelect(`COUNT(*) FILTER (WHERE ${OVERDUE_SQL})`, 'overdue')
      .addSelect('COUNT(*)', 'total')
      .groupBy('pl.id')
      .getRawMany<{ pipelineId: number | null; active: string; overdue: string; total: string }>();

    const pipelines: Record<number, { active: number; overdue: number; total: number }> = {};
    for (const row of rows) {
      if (row.pipelineId === null) continue;
      pipelines[Number(row.pipelineId)] = {
        active: Number(row.active),
        overdue: Number(row.overdue),
        total: Number(row.total),
      };
    }
    return { pipelines };
  }

  /** Doska: jarayon etaplari va ularning vazifalari (yopilganlardan faqat oxirgilari). */
  async board(requested: TaskListQueryDto) {
    const query = await this.scoped(requested);
    const pipeline = query.pipeline_id
      ? await this.pipelines.findOneBy({ id: query.pipeline_id })
      : await this.pipelines.findOne({ where: {}, order: { order_id: 'ASC', id: 'ASC' } });
    if (!pipeline) throw new NotFoundException('Воронка не найдена');

    const stages = sortStages(await this.stages.find({ where: { pipeline: { id: pipeline.id } } }));
    const filter: TaskListQueryDto = { ...query, pipeline_id: pipeline.id, stage_id: undefined, state: undefined };

    const counts = await this.applyFilter(this.lightQuery(), filter)
      .select('st.id', 'stageId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('st.id')
      .getRawMany<{ stageId: number; count: string }>();
    const total = new Map(counts.map((row) => [Number(row.stageId), Number(row.count)]));

    const open = await NEWEST_FIRST_BY_DUE(
      this.applyFilter(this.fullQuery(), filter).andWhere(`st.type <> 'done'`),
    ).getMany();
    const done = await this.applyFilter(this.fullQuery(), filter)
      .andWhere(`st.type = 'done'`)
      .orderBy('t.approvedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('t.id', 'DESC')
      .take(DONE_ON_BOARD)
      .getMany();

    const now = Date.now();
    const byStage = new Map<number, ReturnType<TaskService['toView']>[]>();
    for (const task of [...open, ...done]) {
      const list = byStage.get(task.stage.id) ?? [];
      list.push(this.toView(task, now));
      byStage.set(task.stage.id, list);
    }

    return {
      pipeline: { id: pipeline.id, name: pipeline.name },
      doneShown: DONE_ON_BOARD,
      stages: stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        type: stage.type,
        order_id: stage.order_id,
        total: total.get(stage.id) ?? 0,
        tasks: byStage.get(stage.id) ?? [],
      })),
    };
  }

  // ------------------------------------------------------------------ o'zgartirish

  async update(id: number, dto: UpdateTaskDto) {
    const task = await this.tasks.findOne({
      where: { id },
      relations: { responsible: true, participants: true, contract: true, customer: true },
    });
    if (!task) throw new NotFoundException('Задача не найдена');
    const actor = await this.requireUser(dto.user_id);
    // Muddat, javobgar va ishtirokchilarni faqat administrator belgilaydi (ijrochi muddatni surib qo'ymasligi uchun).
    if (!isAdmin(actor)) throw new ForbiddenException('Изменять задачу может только администратор');

    const changes: string[] = [];

    if (dto.title !== undefined && dto.title !== task.title) {
      task.title = dto.title;
      changes.push('название');
    }
    if (dto.description !== undefined && dto.description !== task.description) {
      task.description = dto.description;
      changes.push('описание');
    }
    if (dto.priority !== undefined && dto.priority !== task.priority) {
      task.priority = dto.priority;
      changes.push('приоритет');
    }
    if (dto.dueDate !== undefined) {
      const next = dto.dueDate ? new Date(dto.dueDate) : null;
      if ((next?.getTime() ?? null) !== (task.dueDate?.getTime() ?? null)) {
        task.dueDate = next;
        changes.push('срок');
      }
    }
    if (dto.responsible_id !== undefined) {
      const next = dto.responsible_id ? await this.requireUser(dto.responsible_id) : null;
      if ((next?.id ?? null) !== (task.responsible?.id ?? null)) {
        changes.push(`ответственный: ${fullName(task.responsible)} → ${fullName(next)}`);
        task.responsible = next;
      }
    }

    if (dto.contract_id !== undefined) {
      const next = dto.contract_id ? await this.requireContract(dto.contract_id) : null;
      if ((next?.id ?? null) !== (task.contract?.id ?? null)) {
        changes.push(`договор: ${task.contract?.number ?? '—'} → ${next?.number ?? '—'}`);
        task.contract = next;
      }
    }

    if (dto.customer_id !== undefined) {
      const next = dto.customer_id ? await this.requireCustomer(dto.customer_id) : null;
      if ((next?.id ?? null) !== (task.customer?.id ?? null)) {
        changes.push(`контрагент: ${customerName(task.customer)} → ${customerName(next)}`);
        task.customer = next;
      }
    }

    // Javobgar ishtirokchilar ro'yxatida takrorlanmaydi (javobgar almashsa ham).
    const wanted = dto.participant_ids ?? task.participants.map((user) => user.id);
    const participants = await this.participantsOf(wanted, task.responsible?.id);
    const key = (users: User[]) => users.map((user) => user.id).sort((a, b) => a - b).join(',');
    if (key(participants) !== key(task.participants)) {
      task.participants = participants;
      changes.push('участники');
    }

    if (changes.length) {
      await this.tasks.manager.transaction(async (em) => {
        await em.save(task);
        await this.log(em, task, actor, 'updated', { note: `Изменено: ${changes.join('; ')}` });
      });
    }

    return this.findOne(id);
  }

  /**
   * Vazifaga kontragent (mijoz) biriktirish yoki olib tashlash. Faqat buxgalter (va admin) qila oladi;
   * buxgalter faqat o'ziga tegishli vazifada. Yopilgan vazifada o'zgartirib bo'lmaydi.
   * Tarixga "Изменено: контрагент: A → B" yoziladi.
   */
  async setCustomer(id: number, dto: TaskCustomerDto) {
    const actor = await this.requireUser(dto.user_id);
    if (!canAttachCustomer(actor)) {
      throw new ForbiddenException('Прикреплять контрагента к задаче может только бухгалтер или администратор');
    }
    await this.assertAccess(id, actor);

    const task = await this.tasks.findOne({ where: { id }, relations: { customer: true, stage: true } });
    if (!task) throw new NotFoundException('Задача не найдена');
    if (task.stage?.type === 'done') {
      throw new BadRequestException('Закрытую задачу изменить нельзя: администратор может открыть её заново');
    }

    const next = dto.customer_id ? await this.requireCustomer(dto.customer_id) : null;
    if ((next?.id ?? null) !== (task.customer?.id ?? null)) {
      const note = `Изменено: контрагент: ${customerName(task.customer)} → ${customerName(next)}`;
      await this.tasks.manager.transaction(async (em) => {
        task.customer = next;
        await em.save(task);
        await this.log(em, task, actor, 'updated', { note });
      });
    }
    return this.findOne(id);
  }

  /**
   * Etapdan etapga o'tkazish (doskada sichqoncha bilan surish). Qoidalar:
   *  - "Закрыта" ga faqat administrator o'tkaza oladi (tasdiqlash);
   *  - "На проверке" ga har kim o'tkazadi — bu "vazifani yopish" (tekshiruvga yuborish);
   *  - yopilgan vazifani faqat administrator qayta ochadi.
   */
  private async transition(
    em: EntityManager,
    task: Task,
    target: TaskStage,
    actor: User | null,
    note: string | null,
  ) {
    if (!task.pipeline) throw new BadRequestException('У задачи нет воронки');
    if (target.pipeline.id !== task.pipeline.id) {
      throw new BadRequestException('Этап относится к другой воронке');
    }

    const from = task.stage ?? null;
    if (from && from.id === target.id) throw new BadRequestException('Задача уже находится на этом этапе');

    const admin = isAdmin(actor);
    if (from?.type === 'done' && !admin) {
      throw new ForbiddenException('Закрытую задачу может вернуть в работу только администратор');
    }
    if (target.type === 'done' && !admin) {
      const review = await em.findOne(TaskStage, { where: { pipeline: { id: task.pipeline.id }, type: 'review' } });
      throw new ForbiddenException(
        `Задачу закрывает только администратор. Переведите её на этап «${review?.name ?? 'На проверке'}».`,
      );
    }

    const now = new Date();
    let type: TaskEventType = 'moved';

    if (target.type === 'done') {
      task.approvedBy = actor;
      task.approvedAt = now;
      type = 'approved';
    } else if (target.type === 'review') {
      task.submittedBy = actor;
      task.submittedAt = now;
      task.approvedBy = null;
      task.approvedAt = null;
      type = 'submitted';
    } else {
      if (from?.type === 'done') type = 'reopened';
      else if (from?.type === 'review') type = admin ? 'rejected' : 'moved';
      task.submittedBy = null;
      task.submittedAt = null;
      task.approvedBy = null;
      task.approvedAt = null;
    }

    task.stage = target;
    await em.save(task);
    await this.log(em, task, actor, type, { fromStage: from?.name ?? null, toStage: target.name, note });
  }

  private async loadForMove(em: EntityManager, id: number) {
    const task = await em.findOne(Task, { where: { id }, relations: { pipeline: true, stage: true } });
    if (!task) throw new NotFoundException('Задача не найдена');
    return task;
  }

  async move(id: number, dto: MoveTaskDto) {
    const actor = await this.requireUser(dto.user_id);
    await this.assertAccess(id, actor);
    await this.tasks.manager.transaction(async (em) => {
      const task = await this.loadForMove(em, id);
      const target = await em.findOne(TaskStage, { where: { id: dto.stage_id }, relations: { pipeline: true } });
      if (!target) throw new NotFoundException('Этап не найден');
      await this.transition(em, task, target, actor, dto.note || null);
    });
    return this.findOne(id);
  }

  private async moveToType(id: number, type: 'review' | 'done', dto: TaskActionDto) {
    const actor = await this.requireUser(dto.user_id);
    await this.assertAccess(id, actor);
    await this.tasks.manager.transaction(async (em) => {
      const task = await this.loadForMove(em, id);
      if (!task.pipeline) throw new BadRequestException('У задачи нет воронки');
      const target = await em.findOne(TaskStage, {
        where: { pipeline: { id: task.pipeline.id }, type },
        relations: { pipeline: true },
      });
      if (!target) throw new BadRequestException('В воронке нет нужного этапа');
      await this.transition(em, task, target, actor, dto.note || null);
    });
    return this.findOne(id);
  }

  /** "Yopish": ijrochi vazifani tekshiruvga yuboradi. */
  submit(id: number, dto: TaskActionDto) {
    return this.moveToType(id, 'review', dto);
  }

  /** Administrator tasdiqlaydi: vazifa yopiladi va javobgarga yoziladi. */
  approve(id: number, dto: TaskActionDto) {
    return this.moveToType(id, 'done', dto);
  }

  /** Administrator vazifani sababi bilan qaytaradi — yuborilgan etapga. */
  async reject(id: number, dto: TaskNoteDto) {
    const actor = await this.requireUser(dto.user_id);
    if (!isAdmin(actor)) throw new ForbiddenException('Вернуть задачу на доработку может только администратор');

    await this.tasks.manager.transaction(async (em) => {
      const task = await this.loadForMove(em, id);
      if (task.stage?.type !== 'review') {
        throw new BadRequestException('Вернуть можно только задачу, которая находится на проверке');
      }

      // Qaysi etapdan yuborilgan bo'lsa — o'sha etapga; topilmasa — birinchi oddiy etapga.
      const submitted = await em.findOne(TaskEvent, {
        where: { task: { id }, type: 'submitted' },
        order: { id: 'DESC' },
      });
      const stages = sortStages(await em.find(TaskStage, {
        where: { pipeline: { id: task.pipeline.id } },
        relations: { pipeline: true },
      }));
      const normal = stages.filter((stage) => stage.type === 'normal');
      const target = normal.find((stage) => stage.name === submitted?.fromStage) ?? normal[0];
      if (!target) throw new BadRequestException('В воронке нет обычных этапов');

      await this.transition(em, task, target, actor, dto.note);
    });
    return this.findOne(id);
  }

  async comment(id: number, dto: TaskNoteDto) {
    const actor = await this.requireUser(dto.user_id);
    await this.assertAccess(id, actor);
    const task = await this.tasks.findOneBy({ id });
    if (!task) throw new NotFoundException('Задача не найдена');
    await this.log(this.tasks.manager, task, actor, 'comment', { note: dto.note });
    return this.findOne(id);
  }

  /**
   * "По договору" savdosidan ochilgan shartnoma uchun kuzatuv vazifasini avtomatik ochadi (tizim ochadi,
   * "faqat admin ochadi" qoidasi bu yerda amal qilmaydi). Jarayon — "По договору" (bo'lmasa birinchisi),
   * etap — birinchi oddiy etap. Javobgar yo'q: shartnomani buxgalter olgach unga tayinlanadi.
   */
  async createForContract(em: EntityManager, contract: Contract, creator: User | null) {
    const pipeline =
      (await em.findOne(TaskPipeline, { where: { name: 'По договору' } })) ??
      (await em.findOne(TaskPipeline, { where: {}, order: { order_id: 'ASC', id: 'ASC' } }));
    if (!pipeline) return null;

    const stages = sortStages(await em.find(TaskStage, { where: { pipeline: { id: pipeline.id } } }));
    const stage = stages.find((item) => item.type === 'normal');
    if (!stage) return null;

    const who = customerName(contract.customer);
    const task = await em.save(em.create(Task, {
      title: `Договор ${contract.number}${contract.customer ? `: ${who}` : ''}`.slice(0, 200),
      description: contract.subject ?? '',
      priority: 'normal',
      pipeline,
      stage,
      creator,
      responsible: null,
      participants: [],
      contract,
      customer: contract.customer ?? null,
      dueDate: null,
    }));
    await this.log(em, task, creator, 'created', { toStage: stage.name, note: 'Автоматически: продажа по договору' });
    return task;
  }

  /** Shartnomani buxgalter olganda: shu shartnomadagi javobgarsiz ochiq vazifalar unga tayinlanadi. */
  async assignResponsibleForContract(em: EntityManager, contractId: number, actor: User) {
    const tasks = await em.find(Task, {
      where: { contract: { id: contractId }, responsible: IsNull() },
      relations: { stage: true },
    });
    for (const task of tasks) {
      if (task.stage?.type === 'done') continue;
      task.responsible = actor;
      await em.save(task);
      await this.log(em, task, actor, 'updated', { note: `Изменено: ответственный: — → ${fullName(actor)}` });
    }
  }

  async remove(id: number, userId?: number) {
    const task = await this.tasks.findOneBy({ id });
    if (!task) throw new NotFoundException('Задача не найдена');

    const actor = userId ? await this.users.findOneBy({ id: userId }) : null;
    if (!isAdmin(actor)) throw new ForbiddenException('Удалять задачи может только администратор');

    const stored = await this.files.storedNamesOf({ task_id: id });
    await this.tasks.remove(task);
    await this.files.deleteStored(stored);
    return { message: 'Задача удалена' };
  }
}
