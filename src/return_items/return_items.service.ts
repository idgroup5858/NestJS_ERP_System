import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReturnItemDto } from './dto/create-return_item.dto';
import { UpdateReturnItemDto } from './dto/update-return_item.dto';
import { UpdateSaleItemDto } from 'src/sale_items/dto/update-sale_item.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ReturnItem } from './entities/return_item.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ReturnItemsService {
  constructor(
      @InjectRepository(ReturnItem)
      private readonly returnItemRepository: Repository<ReturnItem>
    ) { }
  
  
  
  
    async create(createReturnItemDto: CreateReturnItemDto) {
      const sale_item = this.returnItemRepository.create({
        ...createReturnItemDto,
        returns: { id: createReturnItemDto.return_id },
        product: { id: createReturnItemDto.product_id },
        warehouse: { id: createReturnItemDto.warehouse_id }
      })
  
      await this.returnItemRepository.save(sale_item);
      return sale_item;
    }
  
    async findAll() {
  
      return this.returnItemRepository.find({
        relations: ["returns", "product", "warehouse"]
      });
    }
  
  
    async findAllPag(page: number, limit: number) {
  
      page = page > 0 ? page : 1;
      limit = limit > 0 ? limit : 10;
  
      const skip = (page - 1) * limit;
  
      const [data, total] = await this.returnItemRepository.findAndCount({
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
  
      const checkSaleItem = await this.returnItemRepository.findOneBy({ id });
      if (!checkSaleItem) throw new NotFoundException("Не найден Продажа итем");
  
      return checkSaleItem;
    }
  
    async update(id: number, updateSaleItemDto: UpdateSaleItemDto) {
      const checkSaleItem = await this.returnItemRepository.findOneBy({ id });
      if (!checkSaleItem) throw new NotFoundException("Не найден Продажа итем");
  
  
      const sale_item = await this.returnItemRepository.preload({
        id,
        ...updateSaleItemDto
      });
  
      if (!sale_item) throw new NotFoundException()
  
      await this.returnItemRepository.save(sale_item)
  
      return sale_item;
    }
  
    async remove(id: number) {
      const checkSaleItem = await this.returnItemRepository.findOneBy({ id });
      if (!checkSaleItem) throw new NotFoundException("Не найден Продажа итем");
      await this.returnItemRepository.remove(checkSaleItem)
      return { message: "Продажа итем удален" }
  
    }
}
