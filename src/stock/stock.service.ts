import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Stock } from './entities/stock.entity';
import { Repository } from 'typeorm';

@Injectable()
export class StockService {


  constructor(
        @InjectRepository(Stock)
        private readonly stocRepository: Repository<Stock>
      ) { }
    
    
    
    
      async create(createStockDto: CreateStockDto) {
        const stock = this.stocRepository.create({
          quantity:createStockDto.quantity,
          product:{id:createStockDto.product_id},
          warehouse:{id:createStockDto.warehouse_id}
        })
    
        await this.stocRepository.save(stock);
        return stock;
      }
    
      async findAll() {
    
        return this.stocRepository.find({
          relations:["product","warehouse"]
        });
      }
      
    
      async findAllPag(page:number,limit:number) {
    
        page = page > 0 ? page : 1;
        limit = limit > 0 ? limit : 10;
    
        const skip = (page - 1) * limit;
    
        const [data, total] = await this.stocRepository.findAndCount({
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
    
        const checkStock = await this.stocRepository.findOneBy({ id });
        if (!checkStock) throw new NotFoundException("Не найден Продукт");
    
        return checkStock;
      }
    
       async update(id: number, updateStockDto: UpdateStockDto) {
         const checkStock = await this.stocRepository.findOneBy({ id });
        if (!checkStock) throw new NotFoundException("Не найден Продукт");
    
    
        const stock = await this.stocRepository.preload({
          id,
          ...updateStockDto
        });
    
        if (!stock) throw new NotFoundException()
    
        await this.stocRepository.save(stock)
    
        return stock;
      }
      async updateFilter(updateStockDto: CreateStockDto) {
         const checkStock = await this.stocRepository.findOne({

          where:{
            product:{id:updateStockDto.product_id},
            warehouse:{id:updateStockDto.warehouse_id}
          }

          });
        if (!checkStock) throw new NotFoundException("Не найден Продукт");
    
    
        // const stock = await this.stocRepository.preload({
        //   id,
        //   ...updateStockDto
        // });
    
        // if (!stock) throw new NotFoundException()
    
        // await this.stocRepository.save(stock)
    
        return checkStock;
      }
    
      async remove(id: number) {
        const checkStock = await this.stocRepository.findOneBy({ id });
        if (!checkStock) throw new NotFoundException("Не найден Продукт");
        await this.stocRepository.remove(checkStock)
        return { message: "Продукт удален" }
    
      }
}
