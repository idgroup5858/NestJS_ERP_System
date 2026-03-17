import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseItemsService } from './purchase_items.service';

describe('PurchaseItemsService', () => {
  let service: PurchaseItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PurchaseItemsService],
    }).compile();

    service = module.get<PurchaseItemsService>(PurchaseItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
