import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Stock } from './entities/stock.entity';
import { Repository } from 'typeorm';
import { ProductService } from 'src/product/product.service';
import { WarehouseService } from 'src/warehouse/warehouse.service';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private readonly stocRepository: Repository<Stock>,
    private readonly productService: ProductService,
    private readonly wareHouseService:WarehouseService,
  ) {}

  async create(createStockDto: CreateStockDto) {
    await this.productService.findOne(createStockDto.product_id);
    await this.wareHouseService.findOne(createStockDto.warehouse_id);

    const stock = this.stocRepository.create({
      quantity: createStockDto.quantity,
      product: { id: createStockDto.product_id },
      warehouse: { id: createStockDto.warehouse_id},
      //user: { id: createStockDto.user_id},
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
  .leftJoinAndSelect('stock.warehouse', 'warehouse');

  // 🔍 Search qo‘shish
  if (search) {
    query.where(
      'product.name LIKE :search OR product.barCode LIKE :search',
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

    checkStock.quantity -= createStockDto.quantity;
   
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

    checkStock.quantity += createStockDto.quantity;
    
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
