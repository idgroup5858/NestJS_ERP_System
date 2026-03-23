import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePurchaseItemDto } from './dto/create-purchase_item.dto';
import { UpdatePurchaseItemDto } from './dto/update-purchase_item.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateSaleItemDto } from 'src/sale_items/dto/update-sale_item.dto';
import { PurchaseItem } from './entities/purchase_item.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PurchaseItemsService {
  constructor(
    @InjectRepository(PurchaseItem)
    private readonly saleItemRepository: Repository<PurchaseItem>
  ) { }




  async create(createSaleItemDto: CreatePurchaseItemDto) {
    const sale_item = this.saleItemRepository.create({
      ...createSaleItemDto,
      purchase: { id: createSaleItemDto.purchase_id },
      product: { id: createSaleItemDto.product_id },
      warehouse: { id: createSaleItemDto.warehouse_id }
    })

    await this.saleItemRepository.save(sale_item);
    return sale_item;
  }

  async findAll() {

    return this.saleItemRepository.find({
      relations: ["purchase", "product", "warehouse"]
    });
  }


  async findAllPag(page: number, limit: number) {

    page = page > 0 ? page : 1;
    limit = limit > 0 ? limit : 10;

    const skip = (page - 1) * limit;

    const [data, total] = await this.saleItemRepository.findAndCount({
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

    const checkSaleItem = await this.saleItemRepository.findOneBy({ id });
    if (!checkSaleItem) throw new NotFoundException("Не найден Продажа итем");

    return checkSaleItem;
  }

  async update(id: number, updateSaleItemDto: UpdateSaleItemDto) {
    const checkSaleItem = await this.saleItemRepository.findOneBy({ id });
    if (!checkSaleItem) throw new NotFoundException("Не найден Продажа итем");


    const sale_item = await this.saleItemRepository.preload({
      id,
      ...updateSaleItemDto
    });

    if (!sale_item) throw new NotFoundException()

    await this.saleItemRepository.save(sale_item)

    return sale_item;
  }

  async remove(id: number) {
    const checkSaleItem = await this.saleItemRepository.findOneBy({ id });
    if (!checkSaleItem) throw new NotFoundException("Не найден Продажа итем");
    await this.saleItemRepository.remove(checkSaleItem)
    return { message: "Продажа итем удален" }

  }
}
