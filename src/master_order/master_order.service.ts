import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { roundMoney } from 'src/common/quantity';
import { Category } from 'src/category/entities/category.entity';
import { Product } from 'src/product/entities/product.entity';
import { Sale } from 'src/sale/entities/sale.entity';
import { Stock } from 'src/stock/entities/stock.entity';
import { User } from 'src/user/entities/user.entity';
import { CreateMasterOrderDto, MasterOrderItemDto } from './dto/master-order.dto';
import { MASTER_ORDER_STATUSES, MasterOrder, MasterOrderStatus } from './entities/master-order.entity';
import { MasterOrderItem } from './entities/master-order-item.entity';

const MAX_LIMIT = 100;

/** Admin holatni faqat shu yo'nalishlarda o'zgartira oladi; "completed" faqat savdo bilan bog'langanda qo'yiladi. */
const TRANSITIONS: Record<MasterOrderStatus, MasterOrderStatus[]> = {
  new: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['preparing', 'cancelled'],
  completed: [],
  cancelled: [],
};

const ACTIVE_STATUSES: MasterOrderStatus[] = ['new', 'preparing', 'ready'];

const clean = (value?: string | null) => {
  const text = value?.trim();
  return text ? text : null;
};

const pageOf = (page: number, limit: number) => {
  const safePage = page > 0 ? page : 1;
  const safeLimit = limit > 0 ? Math.min(limit, MAX_LIMIT) : 10;
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

@Injectable()
export class MasterOrderService {

  constructor(
    @InjectRepository(MasterOrder)
    private readonly orders: Repository<MasterOrder>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Stock)
    private readonly stocks: Repository<Stock>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Sale)
    private readonly sales: Repository<Sale>,
  ) { }

  private itemsTotal(items: { quantity: number, price: number }[]) {
    return roundMoney(items.reduce((sum, item) => sum + item.quantity * item.price, 0));
  }

  private assertStatus(status?: string): MasterOrderStatus | undefined {
    if (!status) return undefined;
    if (!(MASTER_ORDER_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException('Неизвестный статус заказа');
    }
    return status as MasterOrderStatus;
  }

  /** Usta ko'radigan zakaz: kirim narxi, ombor va boshqa ichki maydonlarsiz. */
  private toMasterView(order: MasterOrder) {
    const items = order.items.map(item => ({
      id: item.id,
      product: {
        id: item.product.id,
        name: item.product.name,
        unit: item.product.unit,
        imgUrl: item.product.imgUrl,
        // Tahrirlashda narx turini almashtirish uchun joriy narxlar (kirim narxi chiqmaydi).
        retailPrice: item.product.buyPrice,
        bulkPrice: item.product.bulkPrice,
      },
      quantity: item.quantity,
      priceType: item.priceType,
      price: item.price,
      sum: roundMoney(item.quantity * item.price),
    }));

    return {
      id: order.id,
      status: order.status,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: order.address,
      mapUrl: order.mapUrl,
      serviceFee: order.serviceFee,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items,
      itemsTotal: items.reduce((sum, item) => sum + item.sum, 0),
    };
  }

  /**
   * Narx zakaz paytida serverda mahsulotdan olinadi, ustadan emas.
   * `Product.buyPrice` — sotuv narxi, `bulkPrice` — ulgurji; `Product.price` (kirim narxi) ishlatilmaydi.
   */
  private async buildItems(dtos: MasterOrderItemDto[]) {
    const ids = [...new Set(dtos.map(item => item.product_id))];
    const found = await this.products.find({ where: { id: In(ids) } });
    const byId = new Map(found.map(product => [product.id, product]));

    return dtos.map(dto => {
      const product = byId.get(dto.product_id);
      if (!product) throw new BadRequestException(`Товар №${dto.product_id} не найден`);

      return {
        product: { id: product.id },
        quantity: dto.quantity,
        priceType: dto.priceType,
        price: dto.priceType === 'bulk' ? product.bulkPrice : product.buyPrice,
      };
    });
  }

  // ---------------------------------------------------------------- usta

  /** Filtr uchun kategoriyalar. `/category/all` har bir kategoriya bilan barcha mahsulotlarni (kirim narxi bilan) qaytargani uchun ishlatilmaydi. */
  listCategories() {
    return this.categories.find({ select: { id: true, name: true }, order: { name: 'ASC' } });
  }

  /** Usta uchun mahsulotlar: faqat sotuv/ulgurji narx va "bor/yo'q" belgisi. */
  async listProducts(page: number, limit: number, search?: string, categoryId?: number) {
    const paging = pageOf(page, limit);

    const query = this.products.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    if (search) {
      query.andWhere(
        '(product.name ILIKE :search OR product.barCode ILIKE :search OR product.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (categoryId) {
      query.andWhere('category.id = :categoryId', { categoryId });
    }

    const [products, total] = await query
      .orderBy('product.name', 'ASC')
      .addOrderBy('product.id', 'ASC')
      .skip(paging.skip)
      .take(paging.limit)
      .getManyAndCount();

    const inStock = new Set<number>();
    if (products.length) {
      const rows: { productId: number, total: string }[] = await this.stocks.createQueryBuilder('s')
        .select('s."productId"', 'productId')
        .addSelect('SUM(s.quantity)', 'total')
        .where('s."productId" IN (:...ids)', { ids: products.map(product => product.id) })
        .groupBy('s."productId"')
        .getRawMany();
      rows.forEach(row => { if (parseFloat(row.total) > 0) inStock.add(Number(row.productId)); });
    }

    return {
      meta: { total, page: paging.page, limit: paging.limit, totalPages: Math.ceil(total / paging.limit) },
      data: products.map(product => ({
        id: product.id,
        name: product.name,
        code: product.code,
        barCode: product.barCode,
        imgUrl: product.imgUrl,
        unit: product.unit,
        retailPrice: product.buyPrice,
        bulkPrice: product.bulkPrice,
        category: product.category ? { id: product.category.id, name: product.category.name } : null,
        inStock: inStock.has(product.id),
      })),
    };
  }

  async create(dto: CreateMasterOrderDto) {
    const master = await this.users.findOne({ where: { id: dto.master_id }, select: { id: true } });
    if (!master) throw new NotFoundException('Мастер не найден');

    const items = await this.buildItems(dto.items);

    const order = await this.orders.save(this.orders.create({
      master: { id: master.id },
      status: 'new',
      customerName: dto.customerName.trim(),
      customerPhone: dto.customerPhone.trim(),
      address: clean(dto.address),
      mapUrl: clean(dto.mapUrl),
      serviceFee: dto.serviceFee ?? 0,
      items,
    }));

    return this.findMineOne(master.id, order.id);
  }

  async findMine(masterId: number, page: number, limit: number, status?: string) {
    const paging = pageOf(page, limit);
    const wanted = this.assertStatus(status);

    const [orders, total] = await this.orders.findAndCount({
      where: { master: { id: masterId }, ...(wanted ? { status: wanted } : {}) },
      relations: { items: true },
      order: { id: 'DESC' },
      skip: paging.skip,
      take: paging.limit,
    });

    return {
      meta: { total, page: paging.page, limit: paging.limit, totalPages: Math.ceil(total / paging.limit) },
      data: orders.map(order => ({
        id: order.id,
        status: order.status,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        serviceFee: order.serviceFee,
        createdAt: order.createdAt,
        itemsCount: order.items.length,
        itemsTotal: this.itemsTotal(order.items),
      })),
    };
  }

  async findMineOne(masterId: number, id: number) {
    const order = await this.orders.findOne({
      where: { id, master: { id: masterId } },
      relations: { items: { product: true } },
      order: { items: { id: 'ASC' } },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    return this.toMasterView(order);
  }

  async updateMine(id: number, dto: CreateMasterOrderDto) {
    const items = await this.buildItems(dto.items);

    await this.orders.manager.transaction(async manager => {
      const order = await manager.findOne(MasterOrder, {
        where: { id, master: { id: dto.master_id } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Заказ не найден');
      if (order.status !== 'new') throw new ConflictException('Заказ уже принят — изменить его нельзя');

      await manager.delete(MasterOrderItem, { order: { id } });

      order.customerName = dto.customerName.trim();
      order.customerPhone = dto.customerPhone.trim();
      order.address = clean(dto.address);
      order.mapUrl = clean(dto.mapUrl);
      order.serviceFee = dto.serviceFee ?? 0;
      order.items = items as MasterOrderItem[];
      await manager.save(order);
    });

    return this.findMineOne(dto.master_id, id);
  }

  async cancelMine(masterId: number, id: number) {
    await this.orders.manager.transaction(async manager => {
      const order = await manager.findOne(MasterOrder, {
        where: { id, master: { id: masterId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Заказ не найден');
      if (order.status !== 'new') throw new ConflictException('Заказ уже принят — отменить его нельзя');

      order.status = 'cancelled';
      await manager.save(order);
    });

    return this.findMineOne(masterId, id);
  }

  // ---------------------------------------------------------------- admin

  async countNew() {
    return { count: await this.orders.count({ where: { status: 'new' } }) };
  }

  async findAllPagSearch(page: number, limit: number, search?: string, status?: string) {
    const paging = pageOf(page, limit);
    const wanted = this.assertStatus(status);

    const query = this.orders.createQueryBuilder('o')
      .leftJoin('o.master', 'm')
      .addSelect(['m.id', 'm.username', 'm.surname', 'm.phone'])
      .leftJoin('o.items', 'i')
      .addSelect(['i.id', 'i.quantity', 'i.price']);

    if (wanted) query.andWhere('o.status = :status', { status: wanted });

    if (search) {
      query.andWhere(
        '(m.username ILIKE :search OR m.surname ILIKE :search OR o.customerName ILIKE :search OR o.customerPhone ILIKE :search OR CAST(o.id AS text) = :exact)',
        { search: `%${search}%`, exact: search.trim() },
      );
    }

    const [orders, total] = await query
      .orderBy('o.id', 'DESC')
      .skip(paging.skip)
      .take(paging.limit)
      .getManyAndCount();

    return {
      meta: { total, page: paging.page, limit: paging.limit, totalPages: Math.ceil(total / paging.limit) },
      data: orders.map(order => ({
        id: order.id,
        status: order.status,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        serviceFee: order.serviceFee,
        createdAt: order.createdAt,
        master: order.master,
        itemsCount: order.items.length,
        itemsTotal: this.itemsTotal(order.items),
      })),
    };
  }

  /** To'liq tafsilot: mahsulotlar ombor qoldig'i bilan — savatga tashlash uchun. Usta parol xeshi chiqmaydi. */
  async findOne(id: number) {
    const order = await this.orders.createQueryBuilder('o')
      .leftJoin('o.master', 'm')
      .addSelect(['m.id', 'm.username', 'm.surname', 'm.phone'])
      .leftJoin('o.sale', 'sale')
      .addSelect(['sale.id'])
      .leftJoinAndSelect('o.items', 'i')
      .leftJoinAndSelect('i.product', 'p')
      .leftJoinAndSelect('p.category', 'c')
      .leftJoinAndSelect('p.stock', 's')
      .leftJoinAndSelect('s.warehouse', 'w')
      .where('o.id = :id', { id })
      .orderBy('i.id', 'ASC')
      .getOne();
    if (!order) throw new NotFoundException('Заказ не найден');

    return { ...order, itemsTotal: this.itemsTotal(order.items) };
  }

  async setStatus(id: number, status: MasterOrderStatus) {
    await this.orders.manager.transaction(async manager => {
      const order = await manager.findOne(MasterOrder, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Заказ не найден');
      if (!TRANSITIONS[order.status].includes(status)) {
        throw new ConflictException('Нельзя изменить статус заказа на выбранный');
      }

      order.status = status;
      await manager.save(order);
    });

    return this.findOne(id);
  }

  /** Savdo yaratilgandan keyin chaqiriladi: zakazni yakunlaydi va savdoga bog'laydi. */
  async complete(id: number, saleId: number) {
    const saleExists = await this.sales.exists({ where: { id: saleId } });
    if (!saleExists) throw new NotFoundException('Продажа не найдена');

    await this.orders.manager.transaction(async manager => {
      const order = await manager.findOne(MasterOrder, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Заказ не найден');
      if (!ACTIVE_STATUSES.includes(order.status)) {
        throw new ConflictException('Заказ уже завершён или отменён');
      }

      order.status = 'completed';
      order.sale = { id: saleId } as Sale;
      await manager.save(order);
    });

    return this.findOne(id);
  }
}
