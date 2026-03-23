import { PartialType } from '@nestjs/mapped-types';
import { CreateReturnItemDto } from './create-return_item.dto';

export class UpdateReturnItemDto extends PartialType(CreateReturnItemDto) {}
