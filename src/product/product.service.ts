import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { CategoryService } from 'src/category/category.service';
import path from 'path';
import * as fs from 'fs';

@Injectable()
export class ProductService {


  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly categoryService: CategoryService
  ) { }




  async create(createProductDto: CreateProductDto) {

    const checkCategory = await this.categoryService.findOne(createProductDto.categoryId)
    if (!checkCategory) throw new ConflictException("Категория не найден !")

    const existingProduct = await this.productRepository.findOne({
      where: { barCode: createProductDto.barCode },
    });
    if (existingProduct) throw new ConflictException("Штрих код уже ест !");

    const product = this.productRepository.create(
      {
        ...createProductDto,
        category: { id: createProductDto.categoryId }
      }
    )

    await this.productRepository.save(product);

    return product;
  }

  async findAll() {

    return this.productRepository.find({ relations: ['category', "stock", "stock.warehouse"] });
  }

  async findAllPagSearch(page: number, limit: number, search?: string) {
  page = page > 0 ? page : 1;
  limit = limit > 0 ? limit : 10;

  const skip = (page - 1) * limit;

  const query = this.productRepository.createQueryBuilder('product')
  .leftJoinAndSelect('product.category', 'category')
  .leftJoinAndSelect('product.stock', 'stock')
  .leftJoinAndSelect('stock.warehouse', 'warehouse');

  // 🔍 Search qo‘shish
  if (search) {
    query.where(
      'product.name LIKE :search OR product.barCode LIKE :search',
      { search: `%${search}%` }
    );
  }

  const [data, total] = await query
    .orderBy('product.id', 'DESC')
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

    const [data, total] = await this.productRepository.findAndCount({
      skip,
      take: limit,
      order: { id: 'DESC' }, // ixtiyoriy
      relations: ['category', "stock", "stock.warehouse"]
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

    const checkProduct = await this.productRepository.findOne({
      where: { id },
      relations: ['category', "stock", "stock.warehouse"]
    });
    if (!checkProduct) throw new NotFoundException("Не найден Продукт");

    return checkProduct;
  }


  async update(id: number, updateProductDto: UpdateProductDto) {
    const checkProduct = await this.productRepository.findOneBy({ id });
    if (!checkProduct) throw new NotFoundException("Не найден Продукт");



    const product = await this.productRepository.preload({
      id,
      ...updateProductDto
    });

    if (!product) throw new NotFoundException()

    await this.productRepository.save(product)

    return product;
  }


  async updatewithImage(
        id: number,
        updateProductDto: UpdateProductDto,
        file?: Express.Multer.File,
      ) {
        const checkProduct = await this.productRepository.findOneBy({ id });

        if (!checkProduct) {
          throw new NotFoundException('Не найден Продукт');
        }

        // 1. eski rasmni saqlab qolamiz
        const oldImageUrl = checkProduct.imgUrl;

        const baseUrl = `http://109.196.103.18:3000`;

        const product = await this.productRepository.preload({
          id,
          ...updateProductDto,
          imgUrl: file
            ? `${baseUrl}/uploads/${file.filename}`
            : oldImageUrl,
        });

        if (!product) {
          throw new NotFoundException();
        }

        await this.productRepository.save(product);

        // 2. agar yangi rasm yuklangan bo‘lsa → eski rasmni o‘chiramiz
        if (file && oldImageUrl) {
          const fileName = oldImageUrl.split('/').pop();

          if (fileName) {
            const filePath = path.join(process.cwd(), 'uploads', fileName);

            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }

        return product;
      }
  // async remove(id: number) {
  //   const checkProduct = await this.productRepository.findOneBy({ id });
  //   if (!checkProduct) throw new NotFoundException("Не найден Продукт");
  //   await this.productRepository.remove(checkProduct)
  //   return { message: "Продукт удален" }

  // }

  
      async remove(id: number) {
        const checkProduct = await this.productRepository.findOneBy({ id });

        if (!checkProduct) {
          throw new NotFoundException("Не найден Продукт");
        }

        // 1. image o‘chirish (xavfsiz variant)
        if (checkProduct.imgUrl) {
          const fileName = checkProduct.imgUrl.split('/').pop();

          if (fileName) {
            const filePath = path.join(process.cwd(), 'uploads', fileName);

            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }

        // 2. product o‘chirish
        await this.productRepository.remove(checkProduct);

        return { message: "Продукт удален" };
      }

}