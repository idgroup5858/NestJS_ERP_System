import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProductService {


  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>
  ) { }




  async create(createWareohouseDto: CreateProductDto) {
    const product = this.productRepository.create(createWareohouseDto)

    await this.productRepository.save(product);
    return product;
  }

  async findAll() {

    return this.productRepository.find();
  }

  async findAllPag(page:number,limit:number) {

    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.productRepository.findAndCount({
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

    const checkProduct = await this.productRepository.findOneBy({ id });
    if (!checkProduct) throw new NotFoundException("Не найден Продукт");

    return checkProduct;
  }

  async update(id: number, UpdateProductDto: UpdateProductDto) {
    const checkProduct = await this.productRepository.findOneBy({ id });
    if (!checkProduct) throw new NotFoundException("Не найден Продукт");



    const product = await this.productRepository.preload({
      id,
      ...UpdateProductDto
    });

    if (!product) throw new NotFoundException()

    await this.productRepository.save(product)

    return product;
  }

  async remove(id: number) {
    const checkProduct = await this.productRepository.findOneBy({ id });
    if (!checkProduct) throw new NotFoundException("Не найден Продукт");
    await this.productRepository.remove(checkProduct)
    return { message: "Продукт удален" }

  }


}