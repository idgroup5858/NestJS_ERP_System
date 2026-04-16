import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { log } from 'console';

@Injectable()
export class  PaymentService {





  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>
  ) { }




    async create(dto: CreatePaymentDto) {

      const pay = new Payment();

      pay.amount = dto.amount;
      pay.method = dto.method;

      if (dto.sale_id) {
        pay.sale = { id: dto.sale_id } as any;
      }

      if (dto.purchase_id) {
        pay.purchase = { id: dto.purchase_id } as any;
      }

      if (dto.return_id) {
        pay.returns = { id: dto.return_id } as any;
      }

      return await this.paymentRepository.save(pay);
  }

  // async create(createPaymentDto: CreatePaymentDto) {
  //   const pay = this.paymentRepository.create({
  //     ...createPaymentDto,
  //     sale:{id:createPaymentDto.sale_id},
  //     purchase:{id:createPaymentDto.purchase_id},
  //     returns:{id:createPaymentDto.return_id}
  //   })

  //   await this.paymentRepository.save(pay);
  //   return pay;
  // }

  async createPurchase(createPaymentDto: CreatePaymentDto) {
    const stock = this.paymentRepository.create({
      ...createPaymentDto,
      purchase:{id:createPaymentDto.purchase_id}
    })

    const pay=  await this.paymentRepository.save(stock);
    console.log(pay)
    return pay;
  }

  async createReturn(createPaymentDto: CreatePaymentDto) {
    const pay = this.paymentRepository.create({
      ...createPaymentDto,
      returns:{id:createPaymentDto.return_id}
    })

    await this.paymentRepository.save(pay);
    return pay;
  }

  async findAll() {

    return this.paymentRepository.find({relations:["sale","sale.items","sale.items.product","sale.payments"]});
  }


  async findAllPag(page: number, limit: number) {

    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.paymentRepository.findAndCount({
      skip,
      take: limit,
      order: { id: 'DESC' }, // ixtiyoriy
      relations:["sale","sale.items","sale.items.product","sale.payments"]
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
    if (!checkPayment) throw new NotFoundException("Не найден Плат");

    return checkPayment;
  }

  async update(id: number, updatePaymentkDto: UpdatePaymentDto) {
    const checkPayment = await this.paymentRepository.findOneBy({ id });
    if (!checkPayment) throw new NotFoundException("Не найден Плат");


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
    if (!checkPayment) throw new NotFoundException("Не найден Плат");
    await this.paymentRepository.remove(checkPayment)
    return { message: "Плат удален" }

  }
}
