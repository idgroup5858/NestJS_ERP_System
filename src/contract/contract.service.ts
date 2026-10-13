import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { AttachmentService } from 'src/attachment/attachment.service';
import { Customer } from 'src/customer/entities/customer.entity';
import { TRANSFER_METHOD } from 'src/payment/payment-methods';
import { PaymentService } from 'src/payment/payment.service';
import { Sale } from 'src/sale/entities/sale.entity';
import { Task } from 'src/task/entities/task.entity';
import { TaskService, taskTiming } from 'src/task/task.service';
import { taskState } from 'src/task_pipeline/task-stages';
import { User } from 'src/user/entities/user.entity';
import { CONTRACT_STATUSES, ContractStatus, SUBMITTABLE } from './contract-statuses';
import {
  ContractActionDto,
  ContractListQueryDto,
  ContractNoteDto,
  ContractPaymentDto,
  ContractCustomerDto,
  ContractRequisitesDto,
  ContractStatusDto,
  CreateContractDto,
  UpdateContractDto,
} from './dto/contract.dto';
import { ContractEvent, ContractEventType } from './entities/contract-event.entity';
import { Contract } from './entities/contract.entity';

const MAX_LIMIT = 100;
const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Tashkent';

const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Черновик',
  signed: 'Подписан',
  active: 'В исполнении',
  review: 'На проверке',
  closed: 'Закрыт',
  cancelled: 'Расторгнут',
};

const brief = (user?: User | null) =>
  user ? { id: user.id, username: user.username, surname: user.surname } : null;

const customerBrief = (customer?: Customer | null) =>
  customer
    ? {
      id: customer.id,
      username: customer.username,
      surname: customer.surname,
      phone: customer.phone,
      /** 'organization' — tashkilot (kartochkada "Организация" ko'rsatiladi), aks holda odam. */
      type: customer.type === 'organization' ? 'organization' : 'user',
      // Bank rekvizitlari (kontragent kartasida saqlanadi).
      requisites: {
        orgName: customer.orgName ?? null,
        inn: customer.inn ?? null,
        bankName: customer.bankName ?? null,
        mfo: customer.mfo ?? null,
        account: customer.account ?? null,
        address: customer.address ?? null,
        director: customer.director ?? null,
      },
    }
    : null;

/** Rekvizit maydonlari va ularning tarixdagi nomlari. */
const REQUISITE_FIELDS = {
  orgName: 'организация',
  inn: 'ИНН',
  bankName: 'банк',
  mfo: 'МФО',
  account: 'расчётный счёт',
  address: 'адрес',
  director: 'руководитель',
} as const;

const fullName = (user?: User | null) => (user ? `${user.username} ${user.surname}`.trim() : '—');

const isAdmin = (user?: User | null) => user?.role?.trim().toLowerCase() === 'admin';
const isAccountant = (user?: User | null) => user?.role?.trim().toLowerCase() === 'accountant';

/**
 * Savdodan ochilgan, hali javobgarsiz shartnoma ("свободный"): hamma buxgalterga ko'rinadi,
 * birinchi "oldim" bosgan javobgar bo'ladi.
 */
const POOL_SQL = `(c."responsibleId" IS NULL AND c."saleId" IS NOT NULL)`;

/** Ko'rish sharti: o'ziga tegishli; buxgalter uchun qo'shimcha — "свободные". */
const visibleTo = (pool: boolean) => (pool ? `(${MEMBER_SQL} OR ${POOL_SQL})` : MEMBER_SQL);

/** Biznes sanasi "YYYY-MM-DD" (vaqt mintaqasida). */
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());

const pad = (id: number) => `D-${String(id).padStart(4, '0')}`;

/**
 * Shartnoma xodimga tegishli: u javobgar, ochgan, yoki shu shartnomadagi vazifada javobgar/ishtirokchi
 * (`:memberId`). Administrator bo'lmaganlar faqat shularni ko'radi.
 */
const MEMBER_SQL =
  `(rs.id = :memberId OR cr.id = :memberId OR EXISTS (SELECT 1 FROM task tk WHERE tk."contractId" = c.id AND ` +
  `(tk."responsibleId" = :memberId OR tk."creatorId" = :memberId OR EXISTS ` +
  `(SELECT 1 FROM task_participants tp WHERE tp."taskId" = tk.id AND tp."userId" = :memberId))))`;

type CountedContract = Contract & { tasksCount?: number; attachmentsCount?: number };

@Injectable()
export class ContractService {

  constructor(
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(ContractEvent)
    private readonly events: Repository<ContractEvent>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Sale)
    private readonly sales: Repository<Sale>,
    private readonly files: AttachmentService,
    private readonly payments: PaymentService,
    private readonly taskService: TaskService,
  ) { }

  // ------------------------------------------------------------------ yordamchilar

  private async requireUser(id: number) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException(`Пользователь #${id} не найден`);
    return user;
  }

  private async requireCustomer(id: number) {
    const customer = await this.customers.findOneBy({ id });
    if (!customer) throw new NotFoundException('Контрагент не найден');
    return customer;
  }

  private requireAdmin(actor: User, message: string) {
    if (!isAdmin(actor)) throw new ForbiddenException(message);
  }

  /** Kim so'rayapti: autentifikatsiya qo'shilguncha `user_id` orqali (keyin tokendan). */
  private async requireActor(userId?: number) {
    if (!userId) throw new BadRequestException('Укажите user_id — пользователя, который выполняет запрос');
    return this.requireUser(userId);
  }

  /** Administrator bo'lmagan xodim faqat o'ziga tegishli shartnomani ko'ra va o'zgartira oladi. */
  private async assertAccess(contractId: number, actor: User) {
    if (isAdmin(actor)) return;

    const allowed = await this.lightQuery()
      .where('c.id = :id', { id: contractId })
      .andWhere(visibleTo(isAccountant(actor)), { memberId: actor.id })
      .getCount();
    if (allowed) return;

    if (!(await this.contracts.existsBy({ id: contractId }))) throw new NotFoundException('Договор не найден');
    throw new ForbiddenException('Этот договор вам не назначен');
  }

  private async assertNumberFree(number: string, exceptId?: number) {
    const query = this.contracts.createQueryBuilder('c')
      .select('c.id')
      .where('LOWER(c.number) = LOWER(:number)', { number });
    if (exceptId) query.andWhere('c.id <> :exceptId', { exceptId });
    if (await query.getOne()) throw new ConflictException('Договор с таким номером уже есть');
  }

  private lightQuery() {
    return this.contracts.createQueryBuilder('c')
      .leftJoin('c.customer', 'cu')
      .leftJoin('c.responsible', 'rs')
      .leftJoin('c.creator', 'cr')
      .leftJoin('c.sale', 'sl')
      .leftJoin('c.closedBy', 'cb');
  }

  private fullQuery() {
    return this.lightQuery()
      .leftJoin('c.submittedBy', 'sb')
      .leftJoin('c.approvedBy', 'ab')
      .addSelect(['cu.id', 'cu.username', 'cu.surname', 'cu.phone', 'cu.type'])
      .addSelect(['cu.orgName', 'cu.inn', 'cu.bankName', 'cu.mfo', 'cu.account', 'cu.address', 'cu.director'])
      .addSelect(['sl.id'])
      .addSelect(['rs.id', 'rs.username', 'rs.surname'])
      .addSelect(['cb.id', 'cb.username', 'cb.surname'])
      .addSelect(['cr.id', 'cr.username', 'cr.surname'])
      .addSelect(['sb.id', 'sb.username', 'sb.surname'])
      .addSelect(['ab.id', 'ab.username', 'ab.surname'])
      .loadRelationCountAndMap('c.tasksCount', 'c.tasks')
      .loadRelationCountAndMap('c.attachmentsCount', 'c.attachments');
  }

  private applyFilter(
    query: SelectQueryBuilder<Contract>,
    f: ContractListQueryDto,
    visibility?: { memberId: number; pool: boolean },
  ) {
    if (visibility) query.andWhere(visibleTo(visibility.pool), { memberId: visibility.memberId });
    if (f.unassigned) query.andWhere(POOL_SQL);
    if (f.status) query.andWhere('c.status = :status', { status: f.status });
    if (f.responsible_id) query.andWhere('rs.id = :responsibleId', { responsibleId: f.responsible_id });
    if (f.closed_by_id) query.andWhere('cb.id = :closedById', { closedById: f.closed_by_id });
    if (f.customer_id) query.andWhere('cu.id = :customerId', { customerId: f.customer_id });
    if (f.from) query.andWhere('c.contractDate >= :from', { from: f.from });
    if (f.to) query.andWhere('c.contractDate <= :to', { to: f.to });
    if (f.closed_from || f.closed_to) query.setParameter('tz', TIMEZONE);
    if (f.closed_from) query.andWhere('(c.closedAt AT TIME ZONE :tz)::date >= :closedFrom', { closedFrom: f.closed_from });
    if (f.closed_to) query.andWhere('(c.closedAt AT TIME ZONE :tz)::date <= :closedTo', { closedTo: f.closed_to });
    if (f.search?.trim()) {
      query.andWhere(
        `(c.number ILIKE :search OR c.subject ILIKE :search OR cu.username ILIKE :search ` +
        `OR cu.surname ILIKE :search OR cu.phone ILIKE :search ` +
        `OR (cu.username || ' ' || cu.surname) ILIKE :search)`,
        { search: `%${f.search.trim()}%` },
      );
    }
    return query;
  }

  private toView(contract: CountedContract) {
    return {
      id: contract.id,
      number: contract.number,
      subject: contract.subject,
      amount: contract.amount,
      currency: contract.currency,
      contractDate: contract.contractDate,
      status: contract.status,
      customer: customerBrief(contract.customer),
      saleId: contract.sale?.id ?? null,
      /** Savdodan ochilgan va hali buxgalter olmagan. */
      unassigned: !contract.responsible && !!contract.sale,
      responsible: brief(contract.responsible),
      creator: brief(contract.creator),
      submittedBy: brief(contract.submittedBy),
      submittedAt: contract.submittedAt,
      closedBy: brief(contract.closedBy),
      closedAt: contract.closedAt,
      approvedBy: brief(contract.approvedBy),
      tasksCount: contract.tasksCount ?? 0,
      attachmentsCount: contract.attachmentsCount ?? 0,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  private async log(
    em: EntityManager,
    contract: Contract,
    user: User | null,
    type: ContractEventType,
    extra: { fromStatus?: string | null; toStatus?: string | null; note?: string | null } = {},
  ) {
    await em.save(em.create(ContractEvent, {
      contract,
      user,
      type,
      fromStatus: extra.fromStatus ?? null,
      toStatus: extra.toStatus ?? null,
      note: extra.note ?? null,
    }));
  }

  // ------------------------------------------------------------------ yaratish va o'qish

  async create(dto: CreateContractDto) {
    const creator = await this.requireUser(dto.user_id);
    const customer = dto.customer_id ? await this.requireCustomer(dto.customer_id) : null;
    const responsible = dto.responsible_id ? await this.requireUser(dto.responsible_id) : null;
    const number = dto.number?.trim() || null;
    if (number) await this.assertNumberFree(number);

    try {
      const saved = await this.contracts.manager.transaction(async (em) => {
        const contract = await em.save(em.create(Contract, {
          number: number ?? `tmp-${randomUUID()}`,
          subject: dto.subject || null,
          customer,
          amount: dto.amount ?? 0,
          currency: dto.currency ?? 'UZS',
          contractDate: dto.contractDate ?? null,
          status: dto.status ?? 'draft',
          responsible,
          creator,
        }));

        if (!number) {
          const free = !(await em.exists(Contract, { where: { number: pad(contract.id) } }));
          contract.number = free ? pad(contract.id) : `${pad(contract.id)}-${randomUUID().slice(0, 4)}`;
          await em.save(contract);
        }

        await this.log(em, contract, creator, 'created', { toStatus: contract.status });
        return contract;
      });
      return this.findOne(saved.id);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Договор с таким номером уже есть');
      throw error;
    }
  }

  async findOne(id: number) {
    const contract = await this.fullQuery().where('c.id = :id', { id }).getOne();
    if (!contract) throw new NotFoundException('Договор не найден');

    const tasks = await this.tasks.createQueryBuilder('t')
      .innerJoin('t.contract', 'ct')
      .leftJoin('t.stage', 'st')
      .leftJoin('t.responsible', 'rs')
      .addSelect(['st.id', 'st.name', 'st.color', 'st.type'])
      .addSelect(['rs.id', 'rs.username', 'rs.surname'])
      .where('ct.id = :id', { id })
      .orderBy('t.id', 'DESC')
      .getMany();

    const events = await this.events.createQueryBuilder('e')
      .innerJoin('e.contract', 'ct')
      .leftJoin('e.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.surname'])
      .where('ct.id = :id', { id })
      .orderBy('e.createdAt', 'ASC')
      .addOrderBy('e.id', 'ASC')
      .getMany();

    const now = Date.now();
    return {
      ...this.toView(contract),
      sale: await this.saleBlock(contract.sale?.id),
      files: await this.files.listFor({ contract_id: id }),
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        state: taskState(task.stage?.type),
        stage: task.stage ? { id: task.stage.id, name: task.stage.name, color: task.stage.color, type: task.stage.type } : null,
        responsible: brief(task.responsible),
        dueDate: task.dueDate,
        overdue: taskTiming(task, now).overdue,
      })),
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        user: brief(event.user),
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        createdAt: event.createdAt,
      })),
    };
  }

  /** Kartochka: administratorga har qanday, qolganlarga faqat o'zining shartnomasi. */
  async findOneFor(id: number, userId?: number) {
    const actor = await this.requireActor(userId);
    await this.assertAccess(id, actor);
    return this.findOne(id);
  }

  /**
   * Bog'langan savdo: tovarlar, summalar va to'lovlar. `debt` — qolgan qarz (bank o'tkazmasi kutilmoqda).
   * Qarz formulasi savdolar ro'yxatidagi bilan bir xil: jami − chegirma − to'langan.
   */
  private async saleBlock(saleId?: number | null) {
    if (!saleId) return null;
    const sale = await this.sales.findOne({
      where: { id: saleId },
      relations: { items: { product: true }, payments: true, user: true },
    });
    if (!sale) return null;

    const paid = (sale.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const payable = sale.total - sale.discount;
    return {
      id: sale.id,
      date: sale.date,
      cashier: brief(sale.user),
      total: sale.total,
      discount: sale.discount,
      payable,
      paid,
      debt: Math.max(0, payable - paid),
      items: (sale.items ?? []).map((item) => ({
        id: item.id,
        productId: item.product?.id ?? null,
        name: item.product?.name ?? '—',
        unit: item.product?.unit ?? null,
        quantity: item.quantity,
        price: item.price,
        sum: Math.round(item.quantity * item.price),
      })),
      payments: (sale.payments ?? []).map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: payment.amount,
        date: payment.date,
      })),
    };
  }

  async findAllPagSearch(filter: ContractListQueryDto) {
    const actor = await this.requireActor(filter.user_id);
    const visibility = isAdmin(actor) ? undefined : { memberId: actor.id, pool: isAccountant(actor) };
    const page = (filter.page ?? 0) > 0 ? filter.page! : 1;
    const limit = (filter.limit ?? 0) > 0 ? Math.min(filter.limit!, MAX_LIMIT) : 10;

    const [rows, total] = await this.applyFilter(this.fullQuery(), filter, visibility)
      .orderBy('c.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Holat bo'yicha sonlar: holat filtrisiz (tugmalardagi hisoblagichlar uchun).
    const counts = await this.applyFilter(this.lightQuery(), { ...filter, status: undefined }, visibility)
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.status')
      .getRawMany<{ status: ContractStatus; count: string }>();
    const byStatus = Object.fromEntries(CONTRACT_STATUSES.map((status) => [status, 0])) as Record<ContractStatus, number>;
    for (const row of counts) byStatus[row.status] = Number(row.count);

    // "Свободные": holat va "свободные" filtrisiz, qolgan filtrlar bilan (tugmadagi son uchun).
    const unassigned = await this.applyFilter(
      this.lightQuery(),
      { ...filter, status: undefined, unassigned: undefined },
      visibility,
    ).andWhere(POOL_SQL).getCount();

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: { byStatus, all: Object.values(byStatus).reduce((sum, n) => sum + n, 0), unassigned },
      data: rows.map((row) => this.toView(row)),
    };
  }

  // ------------------------------------------------------------------ o'zgartirish

  async update(id: number, dto: UpdateContractDto) {
    const contract = await this.contracts.findOne({ where: { id }, relations: { customer: true, responsible: true, sale: true } });
    if (!contract) throw new NotFoundException('Договор не найден');
    const actor = await this.requireUser(dto.user_id);
    await this.assertAccess(id, actor);

    // Savdodan ochilgan shartnomada summa, valyuta va kontragent savdodan olinadi.
    if (contract.sale) {
      const touches =
        (dto.amount !== undefined && dto.amount !== contract.amount) ||
        (dto.currency !== undefined && dto.currency !== contract.currency) ||
        (dto.customer_id !== undefined && (dto.customer_id ?? null) !== (contract.customer?.id ?? null));
      if (touches) {
        throw new BadRequestException('Сумма, валюта и контрагент берутся из продажи и в договоре не меняются');
      }
    }
    const changes: string[] = [];

    if (dto.number !== undefined && dto.number !== contract.number) {
      await this.assertNumberFree(dto.number, id);
      contract.number = dto.number;
      changes.push('номер');
    }
    if (dto.subject !== undefined && (dto.subject || null) !== contract.subject) {
      contract.subject = dto.subject || null;
      changes.push('предмет');
    }
    if (dto.customer_id !== undefined) {
      const next = dto.customer_id ? await this.requireCustomer(dto.customer_id) : null;
      if ((next?.id ?? null) !== (contract.customer?.id ?? null)) {
        contract.customer = next;
        changes.push('контрагент');
      }
    }
    if (dto.amount !== undefined && dto.amount !== contract.amount) {
      contract.amount = dto.amount;
      changes.push('сумма');
    }
    if (dto.currency !== undefined && dto.currency !== contract.currency) {
      contract.currency = dto.currency;
      changes.push('валюта');
    }
    if (dto.contractDate !== undefined && (dto.contractDate ?? null) !== contract.contractDate) {
      contract.contractDate = dto.contractDate ?? null;
      changes.push('дата');
    }
    if (dto.responsible_id !== undefined) {
      const next = dto.responsible_id ? await this.requireUser(dto.responsible_id) : null;
      if ((next?.id ?? null) !== (contract.responsible?.id ?? null)) {
        changes.push(`ответственный: ${fullName(contract.responsible)} → ${fullName(next)}`);
        contract.responsible = next;
      }
    }

    if (changes.length) {
      try {
        await this.contracts.manager.transaction(async (em) => {
          await em.save(contract);
          await this.log(em, contract, actor, 'updated', { note: `Изменено: ${changes.join('; ')}` });
        });
      } catch (error) {
        if ((error as { code?: string }).code === '23505') throw new ConflictException('Договор с таким номером уже есть');
        throw error;
      }
    }
    return this.findOne(id);
  }

  /** Yopilish yoki tekshiruv bilan bog'liq maydonlarni tozalaydi. */
  private clearClosing(contract: Contract) {
    contract.submittedBy = null;
    contract.submittedAt = null;
    contract.closedBy = null;
    contract.closedAt = null;
    contract.approvedBy = null;
  }

  /** draft / signed / active / cancelled ga qo'lda o'tkazish. Yopilganni faqat admin qayta ochadi. */
  async setStatus(id: number, dto: ContractStatusDto) {
    const actor = await this.requireUser(dto.user_id);
    await this.assertAccess(id, actor);
    await this.contracts.manager.transaction(async (em) => {
      const contract = await em.findOneBy(Contract, { id });
      if (!contract) throw new NotFoundException('Договор не найден');
      if (contract.status === dto.status) throw new BadRequestException('Договор уже в этом статусе');
      if (contract.status === 'closed') {
        this.requireAdmin(actor, 'Закрытый договор может открыть заново только администратор');
      }

      const from = contract.status;
      this.clearClosing(contract);
      contract.status = dto.status;
      await em.save(contract);

      const type: ContractEventType = from === 'closed' ? 'reopened' : from === 'review' && isAdmin(actor) ? 'rejected' : 'status';
      await this.log(em, contract, actor, type, { fromStatus: from, toStatus: dto.status, note: dto.note || null });
    });
    return this.findOne(id);
  }

  /** Buxgalter "yopdi": shartnoma admin tekshiruviga tushadi. */
  async submit(id: number, dto: ContractActionDto) {
    const actor = await this.requireUser(dto.user_id);
    await this.assertAccess(id, actor);
    await this.contracts.manager.transaction(async (em) => {
      const contract = await em.findOneBy(Contract, { id });
      if (!contract) throw new NotFoundException('Договор не найден');
      if (!SUBMITTABLE.includes(contract.status)) {
        throw new BadRequestException(
          contract.status === 'review' ? 'Договор уже на проверке' : 'Этот договор нельзя отправить на проверку',
        );
      }

      const from = contract.status;
      contract.status = 'review';
      contract.submittedBy = actor;
      contract.submittedAt = new Date();
      await em.save(contract);
      await this.log(em, contract, actor, 'submitted', { fromStatus: from, toStatus: 'review', note: dto.note || null });
    });
    return this.findOne(id);
  }

  /** Administrator tasdiqlaydi: shartnoma yopiladi va javobgar buxgalterga yoziladi. */
  async approve(id: number, dto: ContractActionDto) {
    const actor = await this.requireUser(dto.user_id);
    this.requireAdmin(actor, 'Закрывает договор только администратор');

    await this.contracts.manager.transaction(async (em) => {
      const contract = await em.findOne(Contract, { where: { id }, relations: { responsible: true, submittedBy: true } });
      if (!contract) throw new NotFoundException('Договор не найден');
      if (contract.status === 'closed') throw new BadRequestException('Договор уже закрыт');
      if (contract.status === 'cancelled') throw new BadRequestException('Расторгнутый договор закрыть нельзя');

      const from = contract.status;
      contract.status = 'closed';
      contract.closedAt = new Date();
      contract.closedBy = contract.responsible ?? contract.submittedBy ?? actor;
      contract.approvedBy = actor;
      await em.save(contract);
      await this.log(em, contract, actor, 'approved', { fromStatus: from, toStatus: 'closed', note: dto.note || null });
    });
    return this.findOne(id);
  }

  /** Administrator sababi bilan qaytaradi — tekshiruvga yuborilgan holatga. */
  async reject(id: number, dto: ContractNoteDto) {
    const actor = await this.requireUser(dto.user_id);
    this.requireAdmin(actor, 'Вернуть договор на доработку может только администратор');

    await this.contracts.manager.transaction(async (em) => {
      const contract = await em.findOneBy(Contract, { id });
      if (!contract) throw new NotFoundException('Договор не найден');
      if (contract.status !== 'review') {
        throw new BadRequestException('Вернуть можно только договор, находящийся на проверке');
      }

      const submitted = await em.findOne(ContractEvent, {
        where: { contract: { id }, type: 'submitted' },
        order: { id: 'DESC' },
      });
      const back = (submitted?.fromStatus as ContractStatus | null) ?? 'active';

      this.clearClosing(contract);
      contract.status = SUBMITTABLE.includes(back) ? back : 'active';
      await em.save(contract);
      await this.log(em, contract, actor, 'rejected', { fromStatus: 'review', toStatus: contract.status, note: dto.note });
    });
    return this.findOne(id);
  }

  async comment(id: number, dto: ContractNoteDto) {
    const actor = await this.requireUser(dto.user_id);
    await this.assertAccess(id, actor);
    const contract = await this.contracts.findOneBy({ id });
    if (!contract) throw new NotFoundException('Договор не найден');
    await this.log(this.contracts.manager, contract, actor, 'comment', { note: dto.note });
    return this.findOne(id);
  }

  // ------------------------------------------------------------------ "По договору" savdosi

  /**
   * Savdodan shartnoma ochadi (+ kuzatuv vazifasi). Takror chaqirish xavfsiz: shu savdoning shartnomasi
   * bor bo'lsa, o'shani qaytaradi. Summa = jami − chegirma; kontragent savdodan; javobgar yo'q ("свободный").
   */
  async createFromSale(saleId: number) {
    const existing = await this.contracts.findOne({ where: { sale: { id: saleId } } });
    if (existing) return this.findOne(existing.id);

    const sale = await this.sales.findOne({
      where: { id: saleId },
      relations: { customer: true, user: true, items: { product: true } },
    });
    if (!sale) throw new NotFoundException('Продажа не найдена');
    // Kontragent bo'lmasligi mumkin: buxgalter uni shartnoma kartochkasida tanlaydi (`setCustomer`).

    const names = (sale.items ?? []).slice(0, 3).map((item) => `${item.product?.name ?? '—'} × ${item.quantity}`);
    const more = (sale.items?.length ?? 0) > 3 ? `, +${sale.items.length - 3}` : '';
    const subject = `Продажа №${sale.id}: ${names.join(', ')}${more}`.slice(0, 2000);

    const saved = await this.contracts.manager.transaction(async (em) => {
      const contract = await em.save(em.create(Contract, {
        number: `tmp-${randomUUID()}`,
        subject,
        customer: sale.customer ?? null,
        sale,
        amount: Math.max(0, sale.total - sale.discount),
        currency: 'UZS',
        contractDate: todayIso(),
        status: 'draft',
        responsible: null,
        creator: sale.user ?? null,
      }));

      const free = !(await em.exists(Contract, { where: { number: pad(contract.id) } }));
      contract.number = free ? pad(contract.id) : `${pad(contract.id)}-${randomUUID().slice(0, 4)}`;
      await em.save(contract);

      await this.log(em, contract, sale.user ?? null, 'created', {
        toStatus: 'draft',
        note: `Автоматически: продажа №${sale.id} по договору`,
      });
      await this.taskService.createForContract(em, contract, sale.user ?? null);
      return contract;
    });
    return this.findOne(saved.id);
  }

  /** Admin uchun: avtomatik ochilmay qolgan bo'lsa qo'lda qayta urinish. */
  async createFromSaleByAdmin(saleId: number, dto: ContractActionDto) {
    const actor = await this.requireUser(dto.user_id);
    this.requireAdmin(actor, 'Создать договор по продаже вручную может только администратор');
    return this.createFromSale(saleId);
  }

  /** Shartnoma ustida ishlash: admin yoki shartnomani olgan (javobgar) buxgalter. */
  private assertCanWork(contract: Contract, actor: User) {
    if (isAdmin(actor) || contract.responsible?.id === actor.id) return;
    throw new ForbiddenException(
      contract.responsible
        ? 'Этим договором занимается другой бухгалтер'
        : 'Сначала возьмите договор в работу',
    );
  }

  /** "Взять в работу": birinchi bosgan buxgalter javobgar bo'ladi; bog'langan vazifalar ham unga o'tadi. */
  async take(id: number, dto: ContractActionDto) {
    const actor = await this.requireUser(dto.user_id);
    if (!isAccountant(actor)) throw new ForbiddenException('Взять договор в работу может только бухгалтер');
    await this.assertAccess(id, actor);

    await this.contracts.manager.transaction(async (em) => {
      // Shartli yangilash: ikki buxgalter bir vaqtda bossa, faqat bittasi yutadi.
      const claimed = await em.createQueryBuilder()
        .update(Contract)
        .set({ responsible: { id: actor.id } as User })
        .where('id = :id AND "responsibleId" IS NULL', { id })
        .execute();
      if (!claimed.affected) throw new ConflictException('Договор уже взят в работу другим бухгалтером');

      const contract = await em.findOneByOrFail(Contract, { id });
      await this.log(em, contract, actor, 'updated', { note: `Изменено: ответственный: — → ${fullName(actor)}` });
      await this.taskService.assignResponsibleForContract(em, id, actor);
    });
    return this.findOne(id);
  }

  /**
   * Kontragent tanlash: savdodan kontragentsiz ochilgan shartnomada buxgalter (yoki admin) uni belgilaydi.
   * Faqat kontragent hali yo'q bo'lganda. Savdo va shartnomadagi vazifalarda ham kontragent bo'sh bo'lsa — shu qo'yiladi
   * (qarz va tarix to'g'ri mijozga yozilishi uchun).
   */
  async setCustomer(id: number, dto: ContractCustomerDto) {
    const actor = await this.requireUser(dto.user_id);
    const contract = await this.contracts.findOne({
      where: { id },
      relations: { customer: true, responsible: true, sale: { customer: true } },
    });
    if (!contract) throw new NotFoundException('Договор не найден');
    this.assertCanWork(contract, actor);
    if (contract.customer) {
      throw new BadRequestException('У договора уже указан контрагент — изменить его нельзя');
    }
    const customer = await this.requireCustomer(dto.customer_id);

    await this.contracts.manager.transaction(async (em) => {
      contract.customer = customer;
      await em.save(contract);

      if (contract.sale && !contract.sale.customer) {
        await em.update(Sale, { id: contract.sale.id }, { customer: { id: customer.id } as Customer });
      }
      await em.createQueryBuilder()
        .update(Task)
        .set({ customer: { id: customer.id } as Customer })
        .where('"contractId" = :id AND "customerId" IS NULL', { id })
        .execute();

      await this.log(em, contract, actor, 'updated', {
        note: `Изменено: контрагент: — → ${`${customer.username} ${customer.surname}`.trim()}`,
      });
    });
    return this.findOne(id);
  }

  /**
   * Savdoning kontragenti almashtirilganda (savdo tafsilotidan) unga bog'langan shartnoma ham, uning vazifalari ham
   * yangi kontragentga o'tadi — aks holda shartnoma bir kontragentda, qarz boshqasida qolardi. Savdo tranzaksiyasi
   * ichida chaqiriladi (`em`): shartnoma o'zgarmasa, savdo ham o'zgarmaydi. Shartnoma bo'lmasa — hech narsa qilmaydi.
   * Yopilgan (admin tasdiqlagan) shartnomada rad etiladi: avval admin uni qayta ochishi kerak.
   */
  async followSaleCustomer(em: EntityManager, saleId: number, customer: Customer, actor: User) {
    const contract = await em.findOne(Contract, { where: { sale: { id: saleId } }, relations: { customer: true } });
    if (!contract) return;
    if (contract.status === 'closed') {
      throw new BadRequestException(
        'Договор по этой продаже закрыт — сначала администратор должен открыть его заново, затем можно менять контрагента',
      );
    }

    const name = (value?: Customer | null) => (value ? `${value.username} ${value.surname}`.trim() : '—');
    const before = contract.customer;
    contract.customer = customer;
    await em.save(contract);

    // Vazifalar: shartnomaning o'z kontragentiga biriktirilganlari (yoki bo'shlari) o'tadi.
    const tasks = em.createQueryBuilder().update(Task).set({ customer: { id: customer.id } as Customer });
    if (before) {
      tasks.where('"contractId" = :id AND ("customerId" IS NULL OR "customerId" = :old)', { id: contract.id, old: before.id });
    } else {
      tasks.where('"contractId" = :id AND "customerId" IS NULL', { id: contract.id });
    }
    await tasks.execute();

    await this.log(em, contract, actor, 'updated', {
      note: `Изменено: контрагент: ${name(before)} → ${name(customer)} (в продаже №${saleId})`,
    });
  }

  /** Kontragent rekvizitlari: faqat o'zgargan maydonlar yoziladi; tarixga qaysilari o'zgargani yoziladi. */
  async setRequisites(id: number, dto: ContractRequisitesDto) {
    const actor = await this.requireUser(dto.user_id);
    const contract = await this.contracts.findOne({ where: { id }, relations: { customer: true, responsible: true } });
    if (!contract) throw new NotFoundException('Договор не найден');
    this.assertCanWork(contract, actor);
    if (!contract.customer) throw new BadRequestException('У договора нет контрагента — реквизиты записывать некуда');

    const customer = contract.customer;
    const organization = customer.type === 'organization';
    const changed: string[] = [];
    for (const [field, label] of Object.entries(REQUISITE_FIELDS) as [keyof typeof REQUISITE_FIELDS, string][]) {
      if (dto[field] === undefined) continue;
      const next = dto[field]!.trim() || null;
      // Tashkilotning nomi o'chirilmaydi (u kontragent nomi sifatida hamma joyda ko'rinadi).
      if (organization && field === 'orgName' && !next) continue;
      if (next !== (customer[field] ?? null)) {
        customer[field] = next;
        changed.push(label);
      }
    }
    // Tashkilotda kontragent nomi (username) tashkilot nomi bilan bir xil turadi.
    if (organization && customer.orgName && customer.username !== customer.orgName) {
      customer.username = customer.orgName;
      customer.surname = '';
    }

    if (changed.length) {
      await this.contracts.manager.transaction(async (em) => {
        await em.save(customer);
        await this.log(em, contract, actor, 'updated', { note: `Изменено: реквизиты (${changed.join(', ')})` });
      });
    }
    return this.findOne(id);
  }

  /**
   * Bank o'tkazmasi kelganini kiritish: bog'langan savdoga "Перечисление" to'lovi qo'shiladi (qarz kamayadi).
   * Qolgan qarzdan ko'p kiritib bo'lmaydi.
   */
  async addPayment(id: number, dto: ContractPaymentDto) {
    const actor = await this.requireUser(dto.user_id);
    const contract = await this.contracts.findOne({ where: { id }, relations: { responsible: true, sale: true } });
    if (!contract) throw new NotFoundException('Договор не найден');
    this.assertCanWork(contract, actor);
    if (!contract.sale) throw new BadRequestException('Договор не связан с продажей — принимать оплату не к чему');

    const block = await this.saleBlock(contract.sale.id);
    if (!block || block.debt <= 0) throw new BadRequestException('Продажа уже оплачена полностью');
    if (dto.amount > block.debt) {
      throw new BadRequestException(`Сумма больше остатка долга (${block.debt.toLocaleString('ru-RU')})`);
    }

    await this.payments.create({ sale_id: contract.sale.id, amount: dto.amount, method: TRANSFER_METHOD });
    await this.log(this.contracts.manager, contract, actor, 'payment', {
      note: `Оплата: ${dto.amount.toLocaleString('ru-RU')} сум${dto.note ? ` · ${dto.note}` : ''}`,
    });
    return this.findOne(id);
  }

  async remove(id: number, userId?: number) {
    const contract = await this.contracts.findOneBy({ id });
    if (!contract) throw new NotFoundException('Договор не найден');

    const actor = userId ? await this.users.findOneBy({ id: userId }) : null;
    if (!isAdmin(actor)) throw new ForbiddenException('Удалять договоры может только администратор');

    const stored = await this.files.storedNamesOf({ contract_id: id });
    await this.contracts.remove(contract);
    await this.files.deleteStored(stored);
    return { message: 'Договор удалён' };
  }

  /** Veb uchun: holat nomlari (hisobot va filtrlar). */
  statusLabels() {
    return STATUS_LABELS;
  }
}
