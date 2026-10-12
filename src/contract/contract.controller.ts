import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ContractService } from './contract.service';
import {
  ContractActionDto,
  ContractListQueryDto,
  ContractNoteDto,
  ContractPaymentDto,
  ContractRequisitesDto,
  ContractStatusDto,
  CreateContractDto,
  UpdateContractDto,
} from './dto/contract.dto';

/**
 * Shartnomalar. Fayllar `attachment` modulida (`contract_id` bilan yuklanadi).
 * `user_id` — harakatni bajarayotgan foydalanuvchi (autentifikatsiya qo'shilguncha).
 */
@Controller('contract')
export class ContractController {
  constructor(private readonly contractService: ContractService) { }

  @Post('add')
  create(@Body() dto: CreateContractDto) {
    return this.contractService.create(dto);
  }

  /** Sahifalangan ro'yxat + holat bo'yicha sonlar. Filtrlar: search, status, responsible_id, closed_by_id, customer_id, from/to, closed_from/closed_to. */
  @Get('allpagsearch')
  findAllPagSearch(@Query() query: ContractListQueryDto) {
    return this.contractService.findAllPagSearch(query);
  }

  /** Shartnoma + fayllar + bog'langan vazifalar + tarix. `?user_id=` majburiy: admin bo'lmasa faqat o'zinikini. */
  @Get('getby/:id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('user_id', new ParseIntPipe({ optional: true })) userId?: number,
  ) {
    return this.contractService.findOneFor(id, userId);
  }

  @Patch('update/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContractDto) {
    return this.contractService.update(id, dto);
  }

  /** Savdodan ochilgan, hali javobgarsiz shartnomani buxgalter "oladi" (birinchi olgan yutadi, boshqasiga 409). */
  @Post('take/:id')
  take(@Param('id', ParseIntPipe) id: number, @Body() dto: ContractActionDto) {
    return this.contractService.take(id, dto);
  }

  /** Kontragent rekvizitlari (INN, bank, MFO, hisob raqami...): javobgar buxgalter yoki admin. */
  @Patch('requisites/:id')
  setRequisites(@Param('id', ParseIntPipe) id: number, @Body() dto: ContractRequisitesDto) {
    return this.contractService.setRequisites(id, dto);
  }

  /** Bank o'tkazmasi kelganini kiritish: bog'langan savdoning qarzi kamayadi. */
  @Post('payment/:id')
  addPayment(@Param('id', ParseIntPipe) id: number, @Body() dto: ContractPaymentDto) {
    return this.contractService.addPayment(id, dto);
  }

  /** Faqat admin: savdoga shartnoma (va vazifa) yaratilmay qolgan bo'lsa qayta urinish. Takror chaqirish xavfsiz. */
  @Post('from-sale/:saleId')
  fromSale(@Param('saleId', ParseIntPipe) saleId: number, @Body() dto: ContractActionDto) {
    return this.contractService.createFromSaleByAdmin(saleId, dto);
  }

  /** draft / signed / active / cancelled. */
  @Patch('status/:id')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: ContractStatusDto) {
    return this.contractService.setStatus(id, dto);
  }

  /** Buxgalter "yopdi" — admin tekshiruviga. */
  @Post('submit/:id')
  submit(@Param('id', ParseIntPipe) id: number, @Body() dto: ContractActionDto) {
    return this.contractService.submit(id, dto);
  }

  /** Faqat administrator: shartnoma yopiladi, javobgar buxgalterga yoziladi. */
  @Post('approve/:id')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ContractActionDto) {
    return this.contractService.approve(id, dto);
  }

  /** Faqat administrator, izoh majburiy. */
  @Post('reject/:id')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: ContractNoteDto) {
    return this.contractService.reject(id, dto);
  }

  @Post('comment/:id')
  comment(@Param('id', ParseIntPipe) id: number, @Body() dto: ContractNoteDto) {
    return this.contractService.comment(id, dto);
  }

  /** Faqat administrator: `?user_id=`. */
  @Delete('delete/:id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('user_id', new ParseIntPipe({ optional: true })) userId?: number,
  ) {
    return this.contractService.remove(id, userId);
  }
}
