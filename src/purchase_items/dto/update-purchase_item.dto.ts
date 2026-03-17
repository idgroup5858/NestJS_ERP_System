import { PartialType } from '@nestjs/mapped-types';
import { CreatePurchaseItemDto } from './create-purchase_item.dto';

export class UpdatePurchaseItemDto extends PartialType(CreatePurchaseItemDto) {}
