import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import {
  AttachmentService,
  MAX_FILE_SIZE,
  STORAGE_DIR,
  ensureStorageDir,
  isAllowedType,
} from './attachment.service';

/** Multipart maydonlari satr bo'lib keladi — `@Type` son qiladi. */
class AddAttachmentDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) task_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) contract_id?: number;
  @Type(() => Number) @IsInt() @Min(1) user_id: number;
}

@Controller('attachment')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) { }

  /** multipart/form-data: `file` + `user_id` + (`task_id` yoki `contract_id`). */
  @Post('add')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureStorageDir();
          cb(null, STORAGE_DIR);
        },
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase().slice(0, 10)}`),
      }),
      limits: { fileSize: MAX_FILE_SIZE, files: 1 },
      fileFilter: (_req, file, cb) =>
        isAllowedType(file.mimetype)
          ? cb(null, true)
          : cb(new BadRequestException('Недопустимый тип файла. Разрешены: изображения, PDF, Word, Excel, текст, ZIP'), false),
    }),
  )
  add(@UploadedFile() file: Express.Multer.File, @Body() dto: AddAttachmentDto) {
    return this.attachmentService.add(file, { task_id: dto.task_id, contract_id: dto.contract_id }, dto.user_id);
  }

  /** Rasm va PDF brauzerda ochiladi; `?download=1` — yuklab olish. */
  @Get('file/:id')
  open(@Param('id', ParseIntPipe) id: number, @Query('download') download?: string) {
    return this.attachmentService.open(id, download === '1' || download === 'true');
  }

  /** Administrator yoki yuklagan odam: `?user_id=`. */
  @Delete('delete/:id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('user_id', new ParseIntPipe({ optional: true })) userId?: number,
  ) {
    return this.attachmentService.remove(id, userId);
  }
}
