import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { Repository } from 'typeorm';

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
      'customer.username LIKE :search OR customer.phone LIKE :search',
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
