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

   /**
    * Import uchun: nomlar boʻyicha bitta soʻrovda qidiradi.
    * `findAll`/`findOne` dan farqli oʻlaroq `products` relationi
    * yuklanmaydi — ommaviy importda u juda qimmatga tushadi.
    */
   async findManyByNames(names: string[]) {

     if (names.length === 0) return [];

     // Excel da kategoriya nomi har xil registrda yozilgan boʻlishi mumkin,
     // shuning uchun solishtirish registrga bogʻliq emas.
     return this.categoryRepository
       .createQueryBuilder('category')
       .where('LOWER(category.name) IN (:...names)', {
         names: names.map(name => name.trim().toLowerCase())
       })
       .getMany();
   }

   /** Excel/CSV dan ommaviy import: bazada bor yoki faylda takrorlangan nomlar oʻtkazib yuboriladi. */
   async importMany(items: { name: string }[]) {

     const errors: { index: number, message: string }[] = [];
     const names = new Map<string, { index: number, name: string }>();

     items.forEach((item, index) => {
       const name = `${item?.name ?? ''}`.trim();
       const key = name.toLowerCase();

       if (!name) errors.push({ index, message: "Не указано название" });
       else if (names.has(key)) errors.push({ index, message: "Дубликат названия в файле" });
       else names.set(key, { index, name });
     });

     const existing = await this.findManyByNames([...names.values()].map(row => row.name));
     for (const category of existing) {
       const key = category.name.trim().toLowerCase();
       const row = names.get(key);
       if (row) {
         errors.push({ index: row.index, message: "Категория уже существует" });
         names.delete(key);
       }
     }

     let created = 0;
     const toSave = [...names.values()];

     if (toSave.length > 0) {
       try {
         await this.createManyByNames(toSave.map(row => row.name));
         created = toSave.length;
       } catch (exception) {
         const message = exception instanceof Error ? exception.message : "Ошибка базы данных";
         for (const row of toSave) errors.push({ index: row.index, message });
       }
     }

     return {
       total: items.length,
       created,
       failed: errors.length,
       errors: errors.sort((a, b) => a.index - b.index)
     };
   }

   /** Import uchun: yetishmayotgan kategoriyalarni bitta yozuvda yaratadi. */
   async createManyByNames(names: string[]) {

     if (names.length === 0) return [];

     const categories = names.map(name => this.categoryRepository.create({ name }));

     return this.categoryRepository.save(categories);
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
