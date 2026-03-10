import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentService {





  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>
  ) { }




  async create(createPaymentDto: CreatePaymentDto) {
    const stock = this.paymentRepository.create({
      ...createPaymentDto,
      sale:{id:createPaymentDto.sale_id}
    })

    await this.paymentRepository.save(stock);
    return stock;
  }

  async findAll() {

    return this.paymentRepository.find();
  }


  async findAllPag(page: number, limit: number) {

    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.paymentRepository.findAndCount({
      skip,
      take: limit,
      order: { id: 'DESC' }, // ixtiyoriy
    });

    return {
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data
    };


  }


  async findOne(id: number) {

    const checkPayment = await this.paymentRepository.findOneBy({ id });
    if (!checkPayment) throw new NotFoundException("Не найден Продукт");

    return checkPayment;
  }

  async update(id: number, updatePaymentkDto: UpdatePaymentDto) {
    const checkPayment = await this.paymentRepository.findOneBy({ id });
    if (!checkPayment) throw new NotFoundException("Не найден Продукт");


    const payment = await this.paymentRepository.preload({
      id,
      ...updatePaymentkDto
    });

    if (!payment) throw new NotFoundException()

    await this.paymentRepository.save(payment)

    return payment;
  }

  async remove(id: number) {
    const checkPayment = await this.paymentRepository.findOneBy({ id });
    if (!checkPayment) throw new NotFoundException("Не найден Продукт");
    await this.paymentRepository.remove(checkPayment)
    return { message: "Продукт удален" }

  }
}
