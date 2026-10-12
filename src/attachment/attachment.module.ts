import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from 'src/contract/entities/contract.entity';
import { ContractEvent } from 'src/contract/entities/contract-event.entity';
import { Task } from 'src/task/entities/task.entity';
import { TaskEvent } from 'src/task/entities/task-event.entity';
import { User } from 'src/user/entities/user.entity';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { Attachment } from './entities/attachment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment, User, Task, TaskEvent, Contract, ContractEvent])],
  controllers: [AttachmentController],
  providers: [AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentModule {}
