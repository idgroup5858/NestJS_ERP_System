import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ImportCustomerItemDto } from './dto/import-customer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { In, Repository } from 'typeorm';

@Injectable()
export class CustomerService {

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>
  ) { }
  async create(createCustomerDto: CreateCustomerDto) {

    const checkUser = await this.customerRepository.findOne({

      where: { phone: createCustomerDto.phone },

    });
    if (checkUser) throw new ConflictException("Клиент уже ест !");

    const customer = this.customerRepository.create(createCustomerDto)

    await this.customerRepository.save(customer);
    return customer;
  }

  /**
   * Excel/CSV dan ommaviy import. Bitta buzuq qator butun paketni
   * yiqitmaydi: har bir qator alohida tekshiriladi va xatolar roʻyxati
   * qator raqami bilan qaytariladi. Mavjud telefonlar bitta soʻrovda
   * tekshiriladi, yozish esa bitta `save()` da (TypeOrm uni tranzaksiyaga oʻraydi).
   */
  async importMany(items: ImportCustomerItemDto[]) {

    const errors: { index: number, message: string }[] = [];
    const prepared: { index: number, customer: Customer }[] = [];
    const seenPhones = new Set<string>();

    items.forEach((item, index) => {

      const username = `${item?.username ?? ''}`.trim();
      const surname = `${item?.surname ?? ''}`.trim();
      const phone = `${item?.phone ?? ''}`.trim();

      if (!username || !surname || !phone) {
        errors.push({ index, message: "Заполнены не все обязательные поля" });
        return;
      }

      if (seenPhones.has(phone)) {
        errors.push({ index, message: "Дубликат телефона в файле" });
        return;
      }
      seenPhones.add(phone);

      prepared.push({
        index,
        customer: this.customerRepository.create({ username, surname, phone, type: "user" })
      });
    });

    const toSave: { index: number, customer: Customer }[] = [];
    let created = 0;

    if (prepared.length > 0) {

      const existing = await this.customerRepository.find({
        where: { phone: In([...seenPhones]) }
      });
      const existingPhones = new Set(existing.map(customer => customer.phone));

      for (const row of prepared) {
        if (existingPhones.has(row.customer.phone)) {
          errors.push({ index: row.index, message: "Клиент с таким телефоном уже существует" });
        } else {
          toSave.push(row);
        }
      }

      if (toSave.length > 0) {
        try {
          await this.customerRepository.save(toSave.map(row => row.customer));
          created = toSave.length;
        } catch (exception) {
          // `save()` tranzaksiya, shuning uchun kutilmagan baza xatosida butun
          // paket yozilmaydi. Ochiq 500 qaytarish oʻrniga qaysi qatorlar
          // oʻtmaganini koʻrsatamiz — import qolgan paketlarni davom ettiradi.
          const message = exception instanceof Error ? exception.message : "Ошибка базы данных";
          for (const row of toSave) errors.push({ index: row.index, message });
        }
      }
    }

    return {
      total: items.length,
      created,
      failed: errors.length,
      errors: errors.sort((a, b) => a.index - b.index)
    };
  }

  async findAll() {

    return this.customerRepository.find({
     
    });
  }

async findAllPagSearch(page: number, limit: number, search?: string) {
  page = page > 0 ? page : 1;
  limit = limit > 0 ? limit : 10;

  const skip = (page - 1) * limit;

  const query = this.customerRepository.createQueryBuilder('customer');

  // 🔍 Search qo‘shish
  if (search) {
    query.where(
      'customer.username ILIKE :search OR customer.surname ILIKE :search OR customer.phone ILIKE :search',
      { search: `%${search}%` }
    );
  }

  const [data, total] = await query
    .orderBy('customer.id', 'DESC')
    .skip(skip)
    .take(limit)
    .getManyAndCount();

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

  async findAllPag(page: number, limit: number) {

    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.customerRepository.findAndCount({
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

    const checkCustomer = await this.customerRepository.findOne({
      where:{id},
       relations: ["sale", "purchase", "returns"]
      });
    if (!checkCustomer) throw new NotFoundException("Не найден Клиент с таким адресом электронной почты и паролем.");

    return checkCustomer;
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto) {
    const checkCustomer = await this.customerRepository.findOneBy({ id });
    if (!checkCustomer) throw new NotFoundException("Не найден Клиент с таким адресом электронной почты и паролем.");



    const customer = await this.customerRepository.preload({
      id,
      ...updateCustomerDto
    });

    if (!customer) throw new NotFoundException()

    await this.customerRepository.save(customer)

    return customer;
  }

  async remove(id: number) {
    const checkCustomer = await this.customerRepository.findOneBy({ id });
    if (!checkCustomer) throw new NotFoundException("Не найден Клиент с таким адресом электронной почты и паролем.");
    await this.customerRepository.remove(checkCustomer)
    return { message: "Клиент удален" };
  }
}
