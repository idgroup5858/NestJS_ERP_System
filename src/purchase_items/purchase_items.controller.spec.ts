import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseItemsController } from './purchase_items.controller';
import { PurchaseItemsService } from './purchase_items.service';

describe('PurchaseItemsController', () => {
  let controller: PurchaseItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseItemsController],
      providers: [PurchaseItemsService],
    }).compile();

    controller = module.get<PurchaseItemsController>(PurchaseItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
