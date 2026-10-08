import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ImportProductItemDto } from './dto/import-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Stock } from 'src/stock/entities/stock.entity';
import { Warehouse } from 'src/warehouse/entities/warehouse.entity';
import { In, Repository } from 'typeorm';
import { CategoryService } from 'src/category/category.service';
import path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProductService {


  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly categoryService: CategoryService,
    private readonly configService: ConfigService
  ) { }




  async create(createProductDto: CreateProductDto) {

    const checkCategory = await this.categoryService.findOne(createProductDto.categoryId)
    if (!checkCategory) throw new ConflictException("Категория не найден !")

    // Shtrixkod ixtiyoriy. Boʻsh qiymat NULL boʻlib yoziladi: `unique` ustunda
    // bir nechta NULL ruxsat etiladi, boʻsh satr esa ikkinchi mahsulotda yiqiladi.
    const barCode = `${createProductDto.barCode ?? ''}`.trim() || null;

    if (barCode) {
      const existingProduct = await this.productRepository.findOne({
        where: { barCode },
      });
      if (existingProduct) throw new ConflictException("Штрих код уже ест !");
    }

    const product = this.productRepository.create(
      {
        ...createProductDto,
        barCode: barCode as string,
        category: { id: createProductDto.categoryId }
      }
    )

    await this.productRepository.save(product);

    return product;
  }

  /**
   * Excel katagi "1 500,50" koʻrinishida ham kelishi mumkin.
   * Narx ustunlari bazada butun son, shuning uchun natija yaxlitlanadi —
   * aks holda kasrli qiymat butun paketni yiqitadi.
   */
  private toAmount(value: unknown): number | null {

    if (value === null || value === undefined || `${value}`.trim() === '') return null;

    const amount = Number(`${value}`.replace(/\s/g, '').replace(',', '.'));

    return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : null;
  }

  /**
   * Excel/CSV dan ommaviy import. Kategoriya `id` emas, nomi boʻyicha
   * topiladi va barcha kategoriyalar bitta soʻrovda yechiladi — qatorma-qator
   * `categoryService.findOne()` chaqirish oʻrniga (u har safar kategoriyadagi
   * barcha mahsulotlarni yuklab yuboradi). Bitta buzuq qator butun paketni
   * yiqitmaydi: xatolar qator raqami bilan qaytariladi.
   */
  async importMany(items: ImportProductItemDto[], createMissingCategories = false, warehouseId?: number) {

    if (warehouseId) {
      const warehouse = await this.productRepository.manager.findOneBy(Warehouse, { id: warehouseId });
      if (!warehouse) throw new BadRequestException("Склад не найден");
    }

    const errors: { index: number, message: string }[] = [];
    const rows: {
      index: number,
      name: string,
      barCode: string,
      categoryKey: string,
      price: number,
      bulkPrice: number,
      buyPrice: number,
      quantity: number,
      unit: string
    }[] = [];

    const seenBarCodes = new Set<string>();
    const categoryNames = new Map<string, string>();

    items.forEach((item, index) => {

      const name = `${item?.name ?? ''}`.trim();
      const categoryName = `${item?.category ?? ''}`.trim();
      const barCode = `${item?.barCode ?? ''}`.trim();
      // `buyPrice` — sotuv narxi (savdo va qaytarish shu narxda), `price` — kirim narxi.
      const buyPrice = this.toAmount(item?.buyPrice);

      if (!name || !categoryName) {
        errors.push({ index, message: "Заполнены не все обязательные поля" });
        return;
      }

      if (buyPrice === null) {
        errors.push({ index, message: "Неверная цена продажи" });
        return;
      }

      if (barCode && seenBarCodes.has(barCode)) {
        errors.push({ index, message: "Дубликат штрих кода в файле" });
        return;
      }
      if (barCode) seenBarCodes.add(barCode);

      const categoryKey = categoryName.toLowerCase();
      if (!categoryNames.has(categoryKey)) categoryNames.set(categoryKey, categoryName);

      rows.push({
        index,
        name,
        barCode,
        categoryKey,
        price: this.toAmount(item?.price) ?? 0,
        bulkPrice: this.toAmount(item?.bulkPrice) ?? buyPrice,
        buyPrice,
        quantity: this.toAmount(item?.quantity) ?? 0,
        unit: `${item?.unit ?? ''}`.trim() || "Штук"
      });
    });

    const categoryIdByKey = new Map<string, number>();

    if (categoryNames.size > 0) {

      const found = await this.categoryService.findManyByNames([...categoryNames.values()]);
      for (const category of found) {
        categoryIdByKey.set(category.name.trim().toLowerCase(), category.id);
      }

      if (createMissingCategories) {

        const missing = [...categoryNames.entries()]
          .filter(([key]) => !categoryIdByKey.has(key))
          .map(([, name]) => name);

        const created = await this.categoryService.createManyByNames(missing);
        for (const category of created) {
          categoryIdByKey.set(category.name.trim().toLowerCase(), category.id);
        }
      }
    }

    const existingBarCodes = new Set<string>();

    if (seenBarCodes.size > 0) {
      const existing = await this.productRepository.find({
        where: { barCode: In([...seenBarCodes]) }
      });
      for (const product of existing) existingBarCodes.add(product.barCode);
    }

    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const toSave: { index: number, quantity: number, product: Product }[] = [];

    for (const row of rows) {

      const categoryId = categoryIdByKey.get(row.categoryKey);
      if (!categoryId) {
        errors.push({
          index: row.index,
          message: `Категория «${categoryNames.get(row.categoryKey)}» не найдена`
        });
        continue;
      }

      if (row.barCode && existingBarCodes.has(row.barCode)) {
        errors.push({ index: row.index, message: "Товар с таким штрихкодом уже существует" });
        continue;
      }

      toSave.push({
        index: row.index,
        quantity: row.quantity,
        product: this.productRepository.create({
          name: row.name,
          // barCode bazada unique va NOT NULL. Shtrixkodsiz qatorlarga
          // vaqtinchalik belgi beriladi, keyin uni qoʻlda toʻgʻrilash mumkin.
          barCode: row.barCode || `IMP-${stamp}-${row.index}`,
          price: row.price,
          bulkPrice: row.bulkPrice,
          buyPrice: row.buyPrice,
          unit: row.unit,
          category: { id: categoryId }
        })
      });
    }

    let created = 0;

    if (toSave.length > 0) {
      try {
        // Mahsulot va uning ombordagi qoldigʻi birga yoziladi: qoldiqsiz mahsulotni
        // na sotib, na kirim qilib boʻladi, shuning uchun ular ajralib qolmasligi kerak.
        await this.productRepository.manager.transaction(async manager => {
          const saved = await manager.save(Product, toSave.map(row => row.product));

          if (warehouseId) {
            await manager.save(Stock, saved.map((product, i) => manager.create(Stock, {
              quantity: toSave[i].quantity,
              product: { id: product.id },
              warehouse: { id: warehouseId }
            })));
          }
        });
        created = toSave.length;
      } catch (exception) {
        // Tranzaksiya yiqilsa butun paket yozilmaydi. Ochiq 500 qaytarish oʻrniga
        // qaysi qatorlar oʻtmaganini koʻrsatamiz — import qolgan paketlarni davom ettiradi.
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

  async findAll() {

    return this.productRepository.find({ relations: ['category', "stock", "stock.warehouse"] });
  }

  async findAllPagSearch(page: number, limit: number, search?: string, categoryId?: number, stocked = false) {
  page = page > 0 ? page : 1;
  limit = limit > 0 ? limit : 10;

  const skip = (page - 1) * limit;

  const query = this.productRepository.createQueryBuilder('product')
  .leftJoinAndSelect('product.category', 'category')
  .leftJoinAndSelect('product.stock', 'stock')
  .leftJoinAndSelect('stock.warehouse', 'warehouse');

  // 🔍 Search qo‘shish
  if (search) {
    // Qavs shart: aks holda OR kategoriya filtrini chetlab oʻtadi.
    query.andWhere(
      '(product.name ILIKE :search OR product.barCode ILIKE :search)',
      { search: `%${search}%` }
    );
  }

  if (categoryId) {
    query.andWhere('category.id = :categoryId', { categoryId });
  }

  // Faqat omborga biriktirilgan tovarlar (Приход/Возврат). Filtr sahifalashdan
  // oldin bajarilishi shart: aks holda omborsiz yangi tovarlar birinchi
  // sahifalarni egallab, omborlilarni keyingi sahifalarga surib yuboradi.
  if (stocked) {
    query.andWhere('EXISTS (SELECT 1 FROM stock s WHERE s."productId" = product.id)');
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

        const baseUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');

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