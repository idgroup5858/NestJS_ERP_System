import { Test, TestingModule } from '@nestjs/testing';
import { TaskPipelineController } from './task_pipeline.controller';
import { TaskPipelineService } from './task_pipeline.service';

describe('TaskPipelineController', () => {
  let controller: TaskPipelineController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskPipelineController],
      providers: [TaskPipelineService],
    }).compile();

    controller = module.get<TaskPipelineController>(TaskPipelineController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
