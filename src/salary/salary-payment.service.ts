import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { CreateSalaryPaymentDto, UpdateSalaryPaymentDto } from './dto/salary-payment.dto';
import { SALARY_PAYMENT_TYPES, SalaryPayment } from './entities/salary-payment.entity';
import { Salary } from './entities/salary.entity';
import { monthToPeriod } from './period';

const MAX_LIMIT = 100;

export interface SalaryPaymentFilter {
  month?: string;
  employee?: number;
  type?: string;
  search?: string;
}

@Injectable()
export class SalaryPaymentService {

  constructor(
    @InjectRepository(SalaryPayment)
    private readonly payments: Repository<SalaryPayment>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) { }

  private async userRef(userId?: number) {
    if (!userId) return null;
    const exists = await this.users.exists({ where: { id: userId } });
    return exists ? ({ id: userId } as User) : null;
  }

  /** Xodimning shu oydagi barcha to'lovlarida normani yangilaydi (oy bo'yicha norma bitta bo'lishi shart). */
  private setNorm(manager: EntityManager, employeeId: number, period: string, norm: number) {
    return manager.createQueryBuilder()
      .update(SalaryPayment)
      .set({ norm })
      .where('"employeeId" = :employeeId AND period = :period', { employeeId, period })
      .execute();
  }

  async create(dto: CreateSalaryPaymentDto) {
    if (!(await this.users.exists({ where: { id: dto.employee_id } }))) {
      throw new NotFoundException('Сотрудник не найден');
    }
    const period = monthToPeriod(dto.month);
    const user = await this.userRef(dto.user_id);

    const id = await this.payments.manager.transaction(async (manager) => {
      const first = await manager.findOne(SalaryPayment, {
        where: { employee: { id: dto.employee_id }, period },
        order: { id: 'ASC' },
      });

      let norm = dto.norm ?? first?.norm;
      if (norm === undefined) {
        const salary = await manager.findOne(Salary, { where: { employee: { id: dto.employee_id } } });
        norm = salary?.amount;
      }
      if (!norm) {
        throw new BadRequestException('Сотруднику не назначен оклад. Назначьте оклад или укажите оклад за месяц.');
      }
      if (first && norm !== first.norm) await this.setNorm(manager, dto.employee_id, period, norm);

      const payment = await manager.save(manager.create(SalaryPayment, {
        employee: { id: dto.employee_id } as User,
        period,
        norm,
        amount: dto.amount,
        type: dto.type,
        method: dto.method ?? 'cash',
        comment: dto.comment || null,
        user,
      }));
      return payment.id;
    });
    return this.findOne(id);
  }

  private baseQuery() {
    return this.payments.createQueryBuilder('p')
      .leftJoin('p.employee', 'emp')
      .leftJoin('p.user', 'u');
  }

  private applyFilter(query: SelectQueryBuilder<SalaryPayment>, filter: SalaryPaymentFilter) {
    if (filter.month) query.andWhere('p.period = :period', { period: monthToPeriod(filter.month) });
    if (filter.employee) query.andWhere('emp.id = :employee', { employee: filter.employee });
    if (filter.type) {
      if (!(SALARY_PAYMENT_TYPES as readonly string[]).includes(filter.type)) {
        throw new BadRequestException('Тип выплаты: advance | salary');
      }
      query.andWhere('p.type = :type', { type: filter.type });
    }
    if (filter.search?.trim()) {
      query.andWhere(
        "(concat_ws(' ', emp.username, emp.surname) ILIKE :search OR p.comment ILIKE :search)",
        { search: `%${filter.search.trim()}%` },
      );
    }
    return query;
  }

  /** Jurnal: sahifalangan ro'yxat + filtrga mos barcha to'lovlar bo'yicha jami (faqat joriy sahifa emas). */
  async findAllPagSearch(page: number, limit: number, filter: SalaryPaymentFilter) {
    page = page > 0 ? page : 1;
    limit = limit > 0 ? Math.min(limit, MAX_LIMIT) : 10;

    const [data, total] = await this.applyFilter(
      this.baseQuery()
        .addSelect(['emp.id', 'emp.username', 'emp.surname', 'emp.role'])
        .addSelect(['u.id', 'u.username', 'u.surname']),
      filter,
    )
      .orderBy('p.period', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totals: { amount: string; advance: string } | undefined = await this.applyFilter(
      this.baseQuery()
        .select('COALESCE(SUM(p.amount), 0)', 'amount')
        .addSelect("COALESCE(SUM(p.amount) FILTER (WHERE p.type = 'advance'), 0)", 'advance'),
      filter,
    ).getRawOne();

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        amount: Number(totals?.amount ?? 0),
        advance: Number(totals?.advance ?? 0),
        count: total,
      },
      data,
    };
  }

  async findOne(id: number) {
    const payment = await this.baseQuery()
      .addSelect(['emp.id', 'emp.username', 'emp.surname', 'emp.role'])
      .addSelect(['u.id', 'u.username', 'u.surname'])
      .where('p.id = :id', { id })
      .getOne();
    if (!payment) throw new NotFoundException('Выплата не найдена');
    return payment;
  }

  async update(id: number, dto: UpdateSalaryPaymentDto) {
    const payment = await this.findOne(id);

    await this.payments.manager.transaction(async (manager) => {
      const changes: Partial<SalaryPayment> = {};
      if (dto.amount !== undefined) changes.amount = dto.amount;
      if (dto.type !== undefined) changes.type = dto.type;
      if (dto.method !== undefined) changes.method = dto.method;
      if (dto.comment !== undefined) changes.comment = dto.comment || null;
      if (Object.keys(changes).length) await manager.update(SalaryPayment, { id }, changes);

      if (dto.norm !== undefined && dto.norm !== payment.norm) {
        if (payment.employee) await this.setNorm(manager, payment.employee.id, payment.period, dto.norm);
        else await manager.update(SalaryPayment, { id }, { norm: dto.norm });
      }
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    const payment = await this.payments.findOneBy({ id });
    if (!payment) throw new NotFoundException('Выплата не найдена');
    await this.payments.remove(payment);
    return { message: 'Выплата удалена' };
  }
}
