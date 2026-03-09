import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Sale } from './entities/sale.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class SaleService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>
  ) { }




  async create(createSaleDto: CreateSaleDto) {
    const sale = this.saleRepository.create(createSaleDto)

    await this.saleRepository.save(sale);
    return sale;
  }

  async findAll() {

    return this.saleRepository.find();
  }


  async findAllPag(page: number, limit: number) {

    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.saleRepository.findAndCount({
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

    const checkSale = await this.saleRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Продукт");

    return checkSale;
  }

  async update(id: number, updateSaleDto: UpdateSaleDto) {
    const checkSale = await this.saleRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Продукт");

    const sale = await this.saleRepository.preload({
      id,
      ...updateSaleDto
    });

    if (!sale) throw new NotFoundException()

    await this.saleRepository.save(sale)

    return sale;
  }

  async remove(id: number) {
    const checkSale = await this.saleRepository.findOneBy({ id });
    if (!checkSale) throw new NotFoundException("Не найден Продукт");
    await this.saleRepository.remove(checkSale)
    return { message: "Продукт удален" }

  }
}
