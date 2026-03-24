import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoryService {
  
 
   constructor(
     @InjectRepository(Category)
     private readonly categoryRepository: Repository<Category>
   ) { }
 
 
 
 
   async create(createWareohouseDto: CreateCategoryDto) {
     const category = this.categoryRepository.create(createWareohouseDto)
 
     await this.categoryRepository.save(category);
     return category;
   }
 
   async findAll() {
 
     return this.categoryRepository.find({relations:["products"]});
   }
   
 
   async findAllPag(page:number,limit:number) {
 
     page = page > 0 ? page : 1;
     limit = limit > 0 ? limit : 10;
 
     const skip = (page - 1) * limit;
 
     const [data, total] = await this.categoryRepository.findAndCount({
       skip,
       take: limit,
       order: { id: 'DESC' }, // ixtiyoriy
       relations:["products"]
     });
 
     return {
       meta: {
         total,
         page,
         limit,
         totalPages: Math.ceil(total / limit)
         
       },
       data
     };
 
     
   }
 
 
   async findOne(id: number) {
 
     const checkCategory = await this.categoryRepository.findOne({ 
      
      where:{id},
      relations:["products"]

      });
     if (!checkCategory) throw new NotFoundException("Не найден категория");
 
     return checkCategory;
   }
 
   async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    const checkCategory = await this.categoryRepository.findOneBy({ id });
     if (!checkCategory) throw new NotFoundException("Не найден категория");
 
 
     const category = await this.categoryRepository.preload({
       id,
       ...updateCategoryDto
     });
 
     if (!category) throw new NotFoundException()
 
     await this.categoryRepository.save(category)
 
     return category;
   }
 
   async remove(id: number) {
      const checkCategory = await this.categoryRepository.findOneBy({ id });
     if (!checkCategory) throw new NotFoundException("Не найден категория");
 
  await this.categoryRepository.remove(checkCategory)
     return { message: "категория удален" }
 
   }
 
}
