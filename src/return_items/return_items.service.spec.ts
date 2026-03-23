import { Test, TestingModule } from '@nestjs/testing';
import { ReturnItemsService } from './return_items.service';

describe('ReturnItemsService', () => {
  let service: ReturnItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReturnItemsService],
    }).compile();

    service = module.get<ReturnItemsService>(ReturnItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
