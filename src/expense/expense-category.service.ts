import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseCategoryDto } from './dto/expense-category.dto';
import { ExpenseCategory } from './entities/expense-category.entity';
import { Expense } from './entities/expense.entity';
import { DEFAULT_EXPENSE_CATEGORIES } from './expense-categories';

@Injectable()
export class ExpenseCategoryService implements OnModuleInit {

  constructor(
    @InjectRepository(ExpenseCategory)
    private readonly categories: Repository<ExpenseCategory>,
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
  ) { }

  async onModuleInit() {
    await this.ensureDefaults();
  }

  /**
   * Birinchi ishga tushishda tayyor turlar yoziladi. Har safar: xarajatlarda bor, lekin ro'yxatda
   * yo'q turlar (jadvalgacha qo'lda yozilganlar) qo'shiladi; faqat harf kattaligi bilan farq
   * qiladiganlari mavjud tur nomiga keltiriladi — filtr va jami bitta tur bo'yicha chiqishi uchun.
   */
  async ensureDefaults() {
    if ((await this.categories.count()) === 0) {
      await this.categories.insert(DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ name })));
    }

    const used: { category: string }[] = await this.expenses.createQueryBuilder('e')
      .select('DISTINCT e.category', 'category')
      .orderBy('e.category', 'ASC')
      .getRawMany();
    for (const { category } of used) {
      const name = await this.resolve(category);
      if (name !== category) await this.expenses.update({ category }, { category: name });
    }
  }

  /** Ro'yxat tartibi: tayyor turlar, keyin qo'shilganlari. `count` — shu turdagi barcha xarajatlar. */
  async findAll() {
    const rows: { id: number; name: string; count: string }[] = await this.categories.createQueryBuilder('c')
      .leftJoin(Expense, 'e', 'e.category = c.name')
      .select('c.id', 'id')
      .addSelect('c.name', 'name')
      .addSelect('COUNT(e.id)', 'count')
      .groupBy('c.id')
      .orderBy('c.id', 'ASC')
      .getRawMany();
    return rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count) }));
  }

  /** Nomi bo'yicha (harf kattaligisiz) qidiradi; turlar oz, shuning uchun JS da solishtiriladi. */
  private async findByName(name: string, exceptId?: number) {
    const key = name.toLowerCase();
    const rows = await this.categories.find();
    return rows.find((row) => row.id !== exceptId && row.name.toLowerCase() === key) ?? null;
  }

  /** Xarajat saqlanayotganda: mavjud turning nomini qaytaradi, yo'q bo'lsa yangi tur yaratadi. */
  async resolve(name: string) {
    const existing = await this.findByName(name);
    if (existing) return existing.name;
    await this.categories.createQueryBuilder().insert().values({ name }).orIgnore().execute();
    return name;
  }

  async create(dto: ExpenseCategoryDto) {
    if (await this.findByName(dto.name)) throw new ConflictException('Такой вид расхода уже есть');
    const category = await this.categories.save(this.categories.create({ name: dto.name }));
    return { id: category.id, name: category.name, count: 0 };
  }

  /** Qayta nomlash: shu turdagi barcha xarajatlar ham yangi nomga o'tadi. */
  async update(id: number, dto: ExpenseCategoryDto) {
    const category = await this.categories.findOneBy({ id });
    if (!category) throw new NotFoundException('Вид расхода не найден');
    if (await this.findByName(dto.name, id)) {
      throw new ConflictException('Такой вид расхода уже есть. Чтобы объединить их, удалите этот вид и перенесите его расходы в тот.');
    }

    if (dto.name !== category.name) {
      await this.categories.manager.transaction(async (manager) => {
        await manager.update(Expense, { category: category.name }, { category: dto.name });
        await manager.update(ExpenseCategory, { id }, { name: dto.name });
      });
    }
    return { id, name: dto.name, count: await this.expenses.countBy({ category: dto.name }) };
  }

  /** Xarajatlari bor tur o'chirilganda ular `moveTo` turiga o'tkaziladi — xarajatlarning o'zi o'chmaydi. */
  async remove(id: number, moveTo?: number) {
    const category = await this.categories.findOneBy({ id });
    if (!category) throw new NotFoundException('Вид расхода не найден');

    const count = await this.expenses.countBy({ category: category.name });
    let target: ExpenseCategory | null = null;
    if (count > 0) {
      if (!moveTo) throw new ConflictException(`В этом виде есть расходы (${count}). Выберите, в какой вид их перенести.`);
      if (moveTo === id) throw new BadRequestException('Нельзя перенести расходы в удаляемый вид');
      target = await this.categories.findOneBy({ id: moveTo });
      if (!target) throw new NotFoundException('Вид для переноса не найден');
    }

    await this.categories.manager.transaction(async (manager) => {
      if (target) await manager.update(Expense, { category: category.name }, { category: target.name });
      await manager.delete(ExpenseCategory, { id });
    });
    return { message: 'Вид расхода удалён', moved: target ? count : 0 };
  }
}
