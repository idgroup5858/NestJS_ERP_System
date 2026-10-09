import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { CreateExpenseDto, MONTH_PATTERN, UpdateExpenseDto } from './dto/expense.dto';
import { Expense } from './entities/expense.entity';
import { DEFAULT_EXPENSE_CATEGORIES } from './expense-categories';

const MAX_LIMIT = 100;

const monthToPeriod = (month: string) => `${month}-01`;

export interface ExpenseFilter {
  search?: string;
  category?: string;
  month?: string;
}

@Injectable()
export class ExpenseService {

  constructor(
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) { }

  /** Tayyor turlar + oldin qo'lda yozilganlar (takrorlarsiz). */
  async categories() {
    const rows: { category: string }[] = await this.expenses.createQueryBuilder('e')
      .select('DISTINCT e.category', 'category')
      .orderBy('e.category', 'ASC')
      .getRawMany();

    const defaults = [...DEFAULT_EXPENSE_CATEGORIES] as string[];
    const known = new Set(defaults.map((c) => c.toLowerCase()));
    const custom = rows.map((r) => r.category).filter((c) => !known.has(c.toLowerCase()));
    return { defaults, custom };
  }

  private async userRef(userId?: number) {
    if (!userId) return null;
    const exists = await this.users.exists({ where: { id: userId } });
    return exists ? ({ id: userId } as User) : null;
  }

  async create(dto: CreateExpenseDto) {
    const expense = await this.expenses.save(this.expenses.create({
      category: dto.category,
      period: monthToPeriod(dto.month),
      amount: dto.amount,
      comment: dto.comment || null,
      user: await this.userRef(dto.user_id),
    }));
    return this.findOne(expense.id);
  }

  private applyFilter(query: SelectQueryBuilder<Expense>, filter: ExpenseFilter) {
    if (filter.month) {
      if (!MONTH_PATTERN.test(filter.month)) throw new BadRequestException('Месяц должен быть в формате ГГГГ-ММ');
      query.andWhere('e.period = :period', { period: monthToPeriod(filter.month) });
    }
    if (filter.category) {
      query.andWhere('e.category = :category', { category: filter.category });
    }
    if (filter.search?.trim()) {
      query.andWhere('(e.category ILIKE :search OR e.comment ILIKE :search)', { search: `%${filter.search.trim()}%` });
    }
    return query;
  }

  /** Sahifalangan ro'yxat + filtrga mos barcha yozuvlar bo'yicha jami (faqat joriy sahifa emas). */
  async findAllPagSearch(page: number, limit: number, filter: ExpenseFilter) {
    page = page > 0 ? page : 1;
    limit = limit > 0 ? Math.min(limit, MAX_LIMIT) : 10;

    const listQuery = this.applyFilter(
      this.expenses.createQueryBuilder('e')
        .leftJoin('e.user', 'u')
        .addSelect(['u.id', 'u.username', 'u.surname']),
      filter,
    );
    const [data, total] = await listQuery
      .orderBy('e.period', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const byCategory: { category: string; amount: string; count: string }[] = await this.applyFilter(
      this.expenses.createQueryBuilder('e')
        .select('e.category', 'category')
        .addSelect('SUM(e.amount)', 'amount')
        .addSelect('COUNT(*)', 'count')
        .groupBy('e.category')
        .orderBy('amount', 'DESC'),
      filter,
    ).getRawMany();

    const categories = byCategory.map((row) => ({
      category: row.category,
      amount: Number(row.amount),
      count: Number(row.count),
    }));

    return {
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        amount: categories.reduce((sum, row) => sum + row.amount, 0),
        count: total,
        byCategory: categories,
      },
      data,
    };
  }

  async findOne(id: number) {
    const expense = await this.expenses.createQueryBuilder('e')
      .leftJoin('e.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.surname'])
      .where('e.id = :id', { id })
      .getOne();
    if (!expense) throw new NotFoundException('Расход не найден');
    return expense;
  }

  async update(id: number, dto: UpdateExpenseDto) {
    const expense = await this.expenses.findOneBy({ id });
    if (!expense) throw new NotFoundException('Расход не найден');

    if (dto.category !== undefined) expense.category = dto.category;
    if (dto.month !== undefined) expense.period = monthToPeriod(dto.month);
    if (dto.amount !== undefined) expense.amount = dto.amount;
    if (dto.comment !== undefined) expense.comment = dto.comment || null;
    await this.expenses.save(expense);

    return this.findOne(id);
  }

  async remove(id: number) {
    const expense = await this.expenses.findOneBy({ id });
    if (!expense) throw new NotFoundException('Расход не найден');
    await this.expenses.remove(expense);
    return { message: 'Расход удалён' };
  }
}
