import { BadRequestException, ForbiddenException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import { Contract } from 'src/contract/entities/contract.entity';
import { ContractEvent } from 'src/contract/entities/contract-event.entity';
import { Task } from 'src/task/entities/task.entity';
import { TaskEvent } from 'src/task/entities/task-event.entity';
import { User } from 'src/user/entities/user.entity';
import { Attachment } from './entities/attachment.entity';

export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Fayllar statik papkadan tashqarida: faqat API orqali beriladi (keyin autentifikatsiya qo'yiladi). */
export const STORAGE_DIR = join(process.cwd(), 'storage', 'attachments');

/**
 * Ruxsat etilgan turlar. SVG va HTML ataylab yo'q: brauzerda ochilganda skript ishlatishi mumkin.
 */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_TYPES = new Set([
  ...IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
]);

export const isAllowedType = (mime: string) => ALLOWED_TYPES.has(mime);

export type AttachmentKind = 'image' | 'pdf' | 'document';

const kindOf = (mime: string): AttachmentKind =>
  IMAGE_TYPES.includes(mime) ? 'image' : mime === 'application/pdf' ? 'pdf' : 'document';

export const ensureStorageDir = () => mkdirSync(STORAGE_DIR, { recursive: true });

/** Multer asl nomni latin1 deb o'qiydi: kirill/o'zbek nomlar buzilmasligi uchun utf8 ga qaytariladi. */
export const decodeFileName = (name: string) => Buffer.from(name, 'latin1').toString('utf8');

const asciiName = (name: string) => name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');

const isAdmin = (user?: User | null) => user?.role?.trim().toLowerCase() === 'admin';

export interface AttachmentTarget {
  task_id?: number;
  contract_id?: number;
}

@Injectable()
export class AttachmentService {

  constructor(
    @InjectRepository(Attachment)
    private readonly attachments: Repository<Attachment>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
  ) { }

  /** Mijoz uchun ko'rinish: `url` — API'ga nisbatan yo'l. */
  toView(attachment: Attachment) {
    return {
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: kindOf(attachment.mimeType),
      url: `/attachment/file/${attachment.id}`,
      uploadedBy: attachment.uploadedBy
        ? { id: attachment.uploadedBy.id, username: attachment.uploadedBy.username, surname: attachment.uploadedBy.surname }
        : null,
      createdAt: attachment.createdAt,
    };
  }

  async listFor(target: AttachmentTarget) {
    const query = this.attachments.createQueryBuilder('a')
      .leftJoin('a.uploadedBy', 'u')
      .addSelect(['u.id', 'u.username', 'u.surname']);
    if (target.task_id) query.innerJoin('a.task', 't').where('t.id = :id', { id: target.task_id });
    else if (target.contract_id) query.innerJoin('a.contract', 'c').where('c.id = :id', { id: target.contract_id });
    else return [];

    const rows = await query.orderBy('a.createdAt', 'ASC').addOrderBy('a.id', 'ASC').getMany();
    return rows.map((row) => this.toView(row));
  }

  private async removeStoredFile(storedName: string) {
    await unlink(join(STORAGE_DIR, storedName)).catch(() => undefined);
  }

  /** Vazifa/shartnoma o'chirilgach qolib ketgan fayllarni diskdan olib tashlaydi. */
  async deleteStored(storedNames: string[]) {
    await Promise.all(storedNames.map((name) => this.removeStoredFile(name)));
  }

  async storedNamesOf(target: AttachmentTarget) {
    const query = this.attachments.createQueryBuilder('a').select('a.storedName', 'storedName');
    if (target.task_id) query.innerJoin('a.task', 't').where('t.id = :id', { id: target.task_id });
    else if (target.contract_id) query.innerJoin('a.contract', 'c').where('c.id = :id', { id: target.contract_id });
    else return [];
    const rows = await query.getRawMany<{ storedName: string }>();
    return rows.map((row) => row.storedName);
  }

  async add(file: Express.Multer.File | undefined, target: AttachmentTarget, userId: number) {
    const stored = file?.filename;
    try {
      if (!file) throw new BadRequestException('Файл не передан');
      if (!!target.task_id === !!target.contract_id) {
        throw new BadRequestException('Укажите либо task_id, либо contract_id');
      }

      const uploader = await this.users.findOneBy({ id: userId });
      if (!uploader) throw new NotFoundException(`Пользователь #${userId} не найден`);

      let task: Task | null = null;
      let contract: Contract | null = null;
      if (target.task_id) {
        task = await this.tasks.findOneBy({ id: target.task_id });
        if (!task) throw new NotFoundException('Задача не найдена');
      } else {
        contract = await this.contracts.findOneBy({ id: target.contract_id });
        if (!contract) throw new NotFoundException('Договор не найден');
      }

      const name = decodeFileName(file.originalname).slice(0, 255) || 'file';
      const saved = await this.attachments.save(this.attachments.create({
        name,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        task,
        contract,
        uploadedBy: uploader,
      }));

      // Tarixga yoziladi.
      const manager = this.attachments.manager;
      if (task) await manager.save(manager.create(TaskEvent, { task, user: uploader, type: 'file_added', note: name }));
      if (contract) await manager.save(manager.create(ContractEvent, { contract, user: uploader, type: 'file_added', note: name }));

      return this.toView({ ...saved, uploadedBy: uploader } as Attachment);
    } catch (error) {
      if (stored) await this.removeStoredFile(stored);
      throw error;
    }
  }

  /** Faylni yuboradi: rasm va pdf brauzerda ochiladi (`inline`), qolganlari yuklab olinadi. */
  async open(id: number, download: boolean) {
    const attachment = await this.attachments.findOneBy({ id });
    if (!attachment) throw new NotFoundException('Файл не найден');

    const path = join(STORAGE_DIR, attachment.storedName);
    if (!existsSync(path)) throw new NotFoundException('Файл не найден на сервере');

    const inline = !download && kindOf(attachment.mimeType) !== 'document';
    const disposition = inline ? 'inline' : 'attachment';
    const file = new StreamableFile(createReadStream(path), {
      type: attachment.mimeType,
      disposition: `${disposition}; filename="${asciiName(attachment.name)}"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      length: attachment.size,
    });
    return file;
  }

  async remove(id: number, userId?: number) {
    const attachment = await this.attachments.findOne({
      where: { id },
      relations: { uploadedBy: true, task: true, contract: true },
    });
    if (!attachment) throw new NotFoundException('Файл не найден');

    const actor = userId ? await this.users.findOneBy({ id: userId }) : null;
    if (!actor || !(isAdmin(actor) || attachment.uploadedBy?.id === actor.id)) {
      throw new ForbiddenException('Удалить файл может администратор или тот, кто его загрузил');
    }

    await this.attachments.remove(attachment);
    await this.removeStoredFile(attachment.storedName);

    const manager = this.attachments.manager;
    if (attachment.task) {
      await manager.save(manager.create(TaskEvent, { task: attachment.task, user: actor, type: 'file_removed', note: attachment.name }));
    }
    if (attachment.contract) {
      await manager.save(manager.create(ContractEvent, { contract: attachment.contract, user: actor, type: 'file_removed', note: attachment.name }));
    }
    return { message: 'Файл удалён' };
  }
}
