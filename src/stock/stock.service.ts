import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Stock } from './entities/stock.entity';
import { Repository } from 'typeorm';
import { ProductService } from 'src/product/product.service';
import { WarehouseService } from 'src/warehouse/warehouse.service';
import { roundQuantity } from 'src/common/quantity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private readonly stocRepository: Repository<Stock>,
    private readonly productService: ProductService,
    private readonly wareHouseService:WarehouseService,
  ) {}

  /** Har bir qator uchun ombor yozuvi borligini (va kerak boʻlsa yetarli qoldiqni) tekshiradi. */
  async assertAvailable(
    items: { product_id: number, warehouse_id: number, quantity: number }[],
    requireQuantity: boolean
  ) {
    if (!items?.length) throw new BadRequestException('Корзина пуста');

    const needed = new Map<string, number>();
    for (const item of items) {
      if (!item.warehouse_id) throw new BadRequestException('Товар не привязан к складу');
      // Bazada miqdor 3 xonagacha saqlanadi: ortiq xona jimgina yaxlitlanib, ombor bilan farq qilmasin.
      if (!(item.quantity > 0) || roundQuantity(item.quantity) !== item.quantity) {
        throw new BadRequestException('Неверное количество');
      }
      const key = `${item.product_id}:${item.warehouse_id}`;
      needed.set(key, roundQuantity((needed.get(key) ?? 0) + item.quantity));
    }

    for (const [key, quantity] of needed) {
      const [productId, warehouseId] = key.split(':').map(Number);
      const stock = await this.stocRepository.findOne({
        where: { product: { id: productId }, warehouse: { id: warehouseId } },
        relations: ['product'],
      });

      if (!stock) throw new BadRequestException('Не найден остаток');
      if (requireQuantity && stock.quantity < quantity) {
        throw new BadRequestException(
          `Недостаточно товара «${stock.product.name}» на складе: доступно ${stock.quantity}`
        );
      }
    }
  }

  async create(createStockDto: CreateStockDto) {
    await this.productService.findOne(createStockDto.product_id);
    await this.wareHouseService.findOne(createStockDto.warehouse_id);

    const stock = this.stocRepository.create({
      quantity: createStockDto.quantity,
      product: { id: createStockDto.product_id },
      warehouse: { id: createStockDto.warehouse_id},
      user: createStockDto.user_id ? { id: createStockDto.user_id}:undefined,
    });

    await this.stocRepository.save(stock);
    return stock;
  }

  async findAll() {
    return this.stocRepository.find({
      relations: ['product', 'warehouse'],
    });
  }

  async findAllPag(page: number, limit: number) {
    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.stocRepository.findAndCount({
      skip,
      take: limit,
      order: { id: 'DESC' }, // ixtiyoriy
      relations: ['product', 'warehouse'],
    });

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



  async findAllPagSearch(page: number, limit: number, search?: string) {
  page = page > 0 ? page : 1;
  limit = limit > 0 ? limit : 10;

  const skip = (page - 1) * limit;

  const query = this.stocRepository.createQueryBuilder('stock')
  .leftJoinAndSelect('stock.product', 'product')
  .leftJoinAndSelect('stock.user', 'user')
  .leftJoinAndSelect('stock.warehouse', 'warehouse');

  // 🔍 Search qo‘shish
  if (search) {
    query.where(
      'product.name ILIKE :search OR product.barCode ILIKE :search',
      { search: `%${search}%` }
    );
  }

  const [data, total] = await query
    .orderBy('stock.id', 'DESC')
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

  async findOne(id: number) {
    const checkStock = await this.stocRepository.findOne({ 
      where:{id},
      relations: ['product', 'warehouse'],
     });
    if (!checkStock) throw new NotFoundException('Не найден остатокт');

    return checkStock;
  }

  async update(id: number, updateStockDto: UpdateStockDto) {
    const checkStock = await this.stocRepository.findOneBy({ id });
    if (!checkStock) throw new NotFoundException('Не найден остаток');

    const stock = await this.stocRepository.preload({
    id,
    quantity: updateStockDto.quantity,

    product: updateStockDto.product_id
      ? { id: updateStockDto.product_id }
      : undefined,

    warehouse: updateStockDto.warehouse_id
      ? { id: updateStockDto.warehouse_id }
      : undefined,
  });

    if (!stock) throw new NotFoundException();

    await this.stocRepository.save(stock);

    return stock;
  }
  async updateFilter(createStockDto: CreateStockDto) {
    const checkStock = await this.stocRepository.findOne({
      where: {
        product: { id: createStockDto.product_id },
        warehouse: { id: createStockDto.warehouse_id },
      },
    });
    if (!checkStock) throw new NotFoundException('Не найден остаток');

    checkStock.quantity = roundQuantity(checkStock.quantity - createStockDto.quantity);
   
    await this.stocRepository.save(checkStock);

    return checkStock;
  }

  async updateFilterAdd(createStockDto: CreateStockDto) {
    const checkStock = await this.stocRepository.findOne({
      where: {
        product: { id: createStockDto.product_id },
        warehouse: { id: createStockDto.warehouse_id },
      },
    });
    if (!checkStock) throw new NotFoundException('Не найден остаток');

    checkStock.quantity = roundQuantity(checkStock.quantity + createStockDto.quantity);
    
    await this.stocRepository.save(checkStock);

    return checkStock;
  }

  async remove(id: number) {
    const checkStock = await this.stocRepository.findOneBy({ id });
    if (!checkStock) throw new NotFoundException('Не найден остаток');
    await this.stocRepository.remove(checkStock);
    return { message: 'Остаток удален' };
  }
}
