import { Test, TestingModule } from '@nestjs/testing';
import { SaleItemsController } from './sale_items.controller';
import { SaleItemsService } from './sale_items.service';

describe('SaleItemsController', () => {
  let controller: SaleItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaleItemsController],
      providers: [SaleItemsService],
    }).compile();

    controller = module.get<SaleItemsController>(SaleItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
