import { Test, TestingModule } from '@nestjs/testing';
import { SaleItemsService } from './sale_items.service';

describe('SaleItemsService', () => {
  let service: SaleItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SaleItemsService],
    }).compile();

    service = module.get<SaleItemsService>(SaleItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
