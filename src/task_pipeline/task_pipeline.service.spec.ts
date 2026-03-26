import { Test, TestingModule } from '@nestjs/testing';
import { TaskPipelineService } from './task_pipeline.service';

describe('TaskPipelineService', () => {
  let service: TaskPipelineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskPipelineService],
    }).compile();

    service = module.get<TaskPipelineService>(TaskPipelineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
