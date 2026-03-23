import { Test, TestingModule } from '@nestjs/testing';
import { ReturnController } from './return.controller';
import { ReturnService } from './return.service';

describe('ReturnController', () => {
  let controller: ReturnController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReturnController],
      providers: [ReturnService],
    }).compile();

    controller = module.get<ReturnController>(ReturnController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
