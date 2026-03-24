import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Warehouse } from './entities/warehouse.entity';
import { Repository } from 'typeorm';

@Injectable()
export class WarehouseService {


  constructor(
    @InjectRepository(Warehouse)
    private readonly wareHouseRepository:Repository<Warehouse>
  ){}


   async create(createWareohouseDto: CreateWarehouseDto) {
    const checkWareHouse = await this.wareHouseRepository.findOne({
    
      where:{name:createWareohouseDto.name}
      
    });
    if (checkWareHouse) throw new ConflictException("Склад уже ест !");
    const warehouse = this.wareHouseRepository.create(createWareohouseDto)
  
      await this.wareHouseRepository.save(warehouse);
      return warehouse;
    }
  
    async findAll() {
  
      return this.wareHouseRepository.find();
    }
  
    
    async findOne(id: number) {
  
      const checkWareHouse = await this.wareHouseRepository.findOne({
        where:{id},
        relations:["stock"]

       });
      if (!checkWareHouse) throw new NotFoundException("Не найден Склад");
  
      return checkWareHouse;
    }
  
    async update(id: number, updateWarehouseDto: UpdateWarehouseDto) {
      const checkWareHouse = await this.wareHouseRepository.findOneBy({ id });
      if (!checkWareHouse) throw new NotFoundException("Не найден Склад");
  
  
  
      const warehouse = await this.wareHouseRepository.preload({
        id,
        ...updateWarehouseDto
      });
  
      if (!warehouse) throw new NotFoundException()
  
      await this.wareHouseRepository.save(warehouse)
  
      return warehouse;
    }
  
    async remove(id: number) {
      const checkWareHouse = await this.wareHouseRepository.findOneBy({ id });
      if (!checkWareHouse) throw new NotFoundException("Не найден Склад");
      await this.wareHouseRepository.remove(checkWareHouse)
      return { message: "Клиент удален" };
    }
}
