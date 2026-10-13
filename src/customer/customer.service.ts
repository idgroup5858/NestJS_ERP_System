import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ImportCustomerItemDto } from './dto/import-customer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { In, Repository } from 'typeorm';

const clean = (value?: string | null) => {
  const text = (value ?? '').toString().trim();
  return text || null;
};

/** Tashkilot rekvizit maydonlari (kontragent kartasida saqlanadi). */
const REQUISITES = ['orgName', 'inn', 'bankName', 'mfo', 'account', 'address', 'director'] as const;

@Injectable()
export class CustomerService {

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>
  ) { }
  /**
   * Yozilishi kerak bo'lgan maydonlarni tayyorlaydi (yaratish va tahrirlash uchun umumiy).
   *  - odam: ism, familiya, telefon majburiy;
   *  - tashkilot: faqat nomi (`orgName`) majburiy; `username` shu nomdan olinadi, `surname` bo'sh,
   *    telefon va rekvizitlar ixtiyoriy (bo'sh satr — NULL).
   * Yuborilmagan maydon joriy qiymatida qoladi.
   */
  private prepare(dto: Partial<CreateCustomerDto>, current?: Customer) {
    const type = dto.type ?? (current?.type === 'organization' ? 'organization' : 'user');

    const requisites: Partial<Record<(typeof REQUISITES)[number], string | null>> = {};
    for (const field of REQUISITES) {
      requisites[field] = dto[field] !== undefined ? clean(dto[field]) : (current?.[field] ?? null);
    }
    const phone = dto.phone !== undefined ? clean(dto.phone) : (current?.phone ?? null);

    if (type === 'organization') {
      if (!requisites.orgName) throw new BadRequestException('Укажите название организации');
      return { ...requisites, type, username: requisites.orgName, surname: '', phone };
    }

    const username = dto.username !== undefined ? clean(dto.username) : clean(current?.username);
    const surname = dto.surname !== undefined ? clean(dto.surname) : clean(current?.surname);
    if (!username || !surname || !phone) throw new BadRequestException('Заполните имя, фамилию и телефон');
    return { ...requisites, type, username, surname, phone };
  }

  private async assertPhoneFree(phone: string | null, exceptId?: number) {
    if (!phone) return;
    const found = await this.customerRepository.findOne({ where: { phone } });
    if (found && found.id !== exceptId) throw new ConflictException("Клиент уже ест !");
  }

  async create(createCustomerDto: CreateCustomerDto) {
    const data = this.prepare(createCustomerDto);
    await this.assertPhoneFree(data.phone);

    const customer = this.customerRepository.create({
      ...data,
      balance: Number(createCustomerDto.balance) || 0,
    });

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

async findAllPagSearch(page: number, limit: number, search?: string, type?: string) {
  page = page > 0 ? page : 1;
  limit = limit > 0 ? limit : 10;

  const skip = (page - 1) * limit;

  const query = this.customerRepository.createQueryBuilder('customer');

  // 🔍 Qidiruv so'zma-so'z: "Alisher Karimov" yoki "Karimov Alis" ham topiladi — har bir so'z
  // ism, familiya yoki telefondan birida bo'lishi kerak. Bitta so'z uchun xatti-harakat eskisidek.
  // Tashkilot nomi va STIR bo'yicha ham qidiriladi.
  const words = (search ?? '').trim().split(/\s+/).filter(Boolean);
  words.forEach((word, index) => {
    query.andWhere(
      `(customer.username ILIKE :w${index} OR customer.surname ILIKE :w${index} OR customer.phone ILIKE :w${index} ` +
        `OR customer.orgName ILIKE :w${index} OR customer.inn ILIKE :w${index})`,
      { [`w${index}`]: `%${word}%` }
    );
  });

  // Filtr: faqat tashkilotlar yoki faqat odamlar; yuborilmasa — hammasi aralash.
  if (type === 'organization') {
    query.andWhere('customer.type = :orgType', { orgType: 'organization' });
  } else if (type === 'user') {
    query.andWhere("(customer.type IS NULL OR customer.type <> 'organization')");
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



    const data = this.prepare(updateCustomerDto, checkCustomer);
    await this.assertPhoneFree(data.phone, id);

    Object.assign(checkCustomer, data);
    if (updateCustomerDto.balance !== undefined) checkCustomer.balance = Number(updateCustomerDto.balance) || 0;
    await this.customerRepository.save(checkCustomer)

    return checkCustomer;
  }

  async remove(id: number) {
    const checkCustomer = await this.customerRepository.findOneBy({ id });
    if (!checkCustomer) throw new NotFoundException("Не найден Клиент с таким адресом электронной почты и паролем.");
    await this.customerRepository.remove(checkCustomer)
    return { message: "Клиент удален" };
  }
}
