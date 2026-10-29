import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { SetSalaryDto } from './dto/salary.dto';
import { Salary } from './entities/salary.entity';
import { SalaryPayment } from './entities/salary-payment.entity';
import { monthToPeriod, nextMonthStart } from './period';

export type SalaryStatus = 'not_paid' | 'partial' | 'paid';

const sum = (rows: SalaryPayment[]) => rows.reduce((total, row) => total + row.amount, 0);

@Injectable()
export class SalaryService {

  constructor(
    @InjectRepository(Salary)
    private readonly salaries: Repository<Salary>,
    @InjectRepository(SalaryPayment)
    private readonly payments: Repository<SalaryPayment>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) { }

  /**
   * Oklad belgilash yoki o'zgartirish. Yangi oklad to'lovi yo'q oylarga qo'llanadi: to'lovi bor oyning
   * normasi birinchi to'lovda muhrlangan (uni to'lov oynasida o'zgartirish mumkin).
   */
  async set(dto: SetSalaryDto) {
    if (!(await this.users.exists({ where: { id: dto.employee_id } }))) {
      throw new NotFoundException('Сотрудник не найден');
    }
    const salary = await this.salaries.findOne({ where: { employee: { id: dto.employee_id } } });
    if (salary) {
      salary.amount = dto.amount;
      await this.salaries.save(salary);
    } else {
      await this.salaries.save(this.salaries.create({ employee: { id: dto.employee_id } as User, amount: dto.amount }));
    }
    return { employeeId: dto.employee_id, amount: dto.amount };
  }

  /** Okladni olib tashlash (masalan, ishdan ketgan xodim). To'lovlar tarixi o'chmaydi. */
  async remove(employeeId: number) {
    const salary = await this.salaries.findOne({ where: { employee: { id: employeeId } } });
    if (!salary) throw new NotFoundException('Оклад сотруднику не назначен');
    await this.salaries.remove(salary);
    return { message: 'Оклад снят' };
  }

  /**
   * Oy vedomosti: har bir xodimga norma, to'langan, qolgan va holat (to'liq / qisman / olmagan).
   * Qatorlarga okladi shu oy oxirigacha belgilangan yoki shu oyda to'lovi bor xodimlar kiradi — aks holda
   * o'tgan oylarda yangi xodimlar "to'lanmagan" bo'lib ko'rinardi.
   * `employees` — barcha xodimlar va joriy okladi (to'lov oynasidagi ro'yxat uchun).
   */
  async sheet(month?: string) {
    const period = monthToPeriod(month);
    const monthEnd = nextMonthStart(month!);

    const [employees, salaries, payments] = await Promise.all([
      this.users.find({
        select: { id: true, username: true, surname: true, role: true },
        order: { username: 'ASC', surname: 'ASC', id: 'ASC' },
      }),
      this.salaries.createQueryBuilder('s')
        .leftJoin('s.employee', 'emp')
        .addSelect('emp.id')
        .getMany(),
      this.payments.createQueryBuilder('p')
        .leftJoin('p.employee', 'emp')
        .addSelect('emp.id')
        .leftJoin('p.user', 'u')
        .addSelect(['u.id', 'u.username', 'u.surname'])
        .where('p.period = :period', { period })
        .orderBy('p.createdAt', 'ASC')
        .addOrderBy('p.id', 'ASC')
        .getMany(),
    ]);

    const salaryBy = new Map(salaries.map((salary) => [salary.employee.id, salary]));
    const paymentsBy = new Map<number, SalaryPayment[]>();
    for (const payment of payments) {
      // O'chirilgan xodimning to'lovi vedomostda ko'rinmaydi (jurnal va statistikada qoladi).
      if (!payment.employee) continue;
      const list = paymentsBy.get(payment.employee.id) ?? [];
      list.push(payment);
      paymentsBy.set(payment.employee.id, list);
    }

    const rows = employees.flatMap((employee) => {
      const salary = salaryBy.get(employee.id);
      const list = paymentsBy.get(employee.id) ?? [];
      if (!list.length && !(salary && salary.createdAt < monthEnd)) return [];

      const norm = list.length ? list[0].norm : salary!.amount;
      const paid = sum(list);
      const status: SalaryStatus = paid <= 0 ? 'not_paid' : paid >= norm ? 'paid' : 'partial';
      return [{
        employee,
        salary: salary?.amount ?? null,
        norm,
        paid,
        advance: sum(list.filter((payment) => payment.type === 'advance')),
        remaining: Math.max(norm - paid, 0),
        overpaid: Math.max(paid - norm, 0),
        status,
        payments: list,
      }];
    });

    const count = (status: SalaryStatus) => rows.filter((row) => row.status === status).length;
    return {
      month,
      summary: {
        employees: rows.length,
        norm: rows.reduce((total, row) => total + row.norm, 0),
        paid: rows.reduce((total, row) => total + row.paid, 0),
        advance: rows.reduce((total, row) => total + row.advance, 0),
        remaining: rows.reduce((total, row) => total + row.remaining, 0),
        overpaid: rows.reduce((total, row) => total + row.overpaid, 0),
        counts: { paid: count('paid'), partial: count('partial'), not_paid: count('not_paid') },
      },
      rows,
      employees: employees.map((employee) => ({ ...employee, salary: salaryBy.get(employee.id)?.amount ?? null })),
    };
  }
}
