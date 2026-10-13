import { Transform, Type } from "class-transformer";
import { ArrayUnique, IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateIf } from "class-validator";
import { TASK_PRIORITIES } from "../entities/task.entity";
import type { TaskPriority } from "../entities/task.entity";

export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTaskDto {

    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите название задачи' })
    @MaxLength(200)
    title: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(5000)
    description?: string;

    @IsOptional()
    @IsIn(TASK_PRIORITIES, { message: 'Приоритет: low, normal или high' })
    priority?: TaskPriority;

    /** Jarayon (voronka). */
    @IsInt()
    @Min(1)
    pipeline_id: number;

    /** Boshlang'ich etap (faqat oddiy). Berilmasa — jarayonning birinchi etapi. */
    @IsOptional()
    @IsInt()
    @Min(1)
    stage_id?: number;

    /** Tugash vaqti, ISO: "2026-10-20T18:00:00.000Z". */
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    /** Asosiy javobgar. */
    @IsOptional()
    @IsInt()
    @Min(1)
    responsible_id?: number;

    /** Qo'shimcha ijrochilar. */
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    @Min(1, { each: true })
    participant_ids?: number[];

    /** Vazifa qaysi shartnoma ustida bajariladi. */
    @IsOptional()
    @IsInt()
    @Min(1)
    contract_id?: number;

    /** Kontragent (mijoz) id si — `customer` jadvalidan. */
    @IsOptional()
    @IsInt()
    @Min(1)
    customer_id?: number;

    /** Vazifani ochgan foydalanuvchi (faqat Admin vazifa ocha oladi). */
    @IsInt()
    @Min(1)
    user_id: number;
}

/** `dueDate` va `responsible_id` ga `null` yuborilsa — tozalanadi; yuborilmasa — o'zgarmaydi. */
export class UpdateTaskDto {

    @IsOptional()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите название задачи' })
    @MaxLength(200)
    title?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(5000)
    description?: string;

    @IsOptional()
    @IsIn(TASK_PRIORITIES, { message: 'Приоритет: low, normal или high' })
    priority?: TaskPriority;

    @IsOptional()
    @IsDateString()
    dueDate?: string | null;

    @IsOptional()
    @IsInt()
    @Min(1)
    responsible_id?: number | null;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    @Min(1, { each: true })
    participant_ids?: number[];

    /** `null` — shartnomadan ajratadi. */
    @IsOptional()
    @IsInt()
    @Min(1)
    contract_id?: number | null;

    /** `null` — kontragentni olib tashlaydi. */
    @IsOptional()
    @IsInt()
    @Min(1)
    customer_id?: number | null;

    /** Kim o'zgartiryapti: faqat Admin tahrirlay oladi (qolganlarga 403); tarix uchun ham ishlatiladi. */
    @IsInt()
    @Min(1)
    user_id: number;
}

export class MoveTaskDto {

    @IsInt()
    @Min(1)
    stage_id: number;

    @IsInt()
    @Min(1)
    user_id: number;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(2000)
    note?: string;
}

/** Vazifaga kontragent biriktirish: faqat buxgalter (va admin). `customer_id: null` — olib tashlaydi. */
export class TaskCustomerDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @ValidateIf((_, value) => value !== null)
    @IsInt()
    @Min(1)
    customer_id: number | null;
}

/** `submit` va `approve` uchun: kim bajaryapti (+ ixtiyoriy izoh). */
export class TaskActionDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(2000)
    note?: string;
}

/** `reject` va `comment` uchun: izoh majburiy. */
export class TaskNoteDto {

    @IsInt()
    @Min(1)
    user_id: number;

    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Напишите комментарий' })
    @MaxLength(2000)
    note: string;
}

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

/** Ro'yxat (sahifalangan) va doska uchun umumiy filtrlar. */
export class TaskListQueryDto {

    @IsOptional() @Type(() => Number) @IsInt() page?: number;
    @IsOptional() @Type(() => Number) @IsInt() limit?: number;

    /**
     * Kim so'rayapti. Administrator hamma vazifani ko'radi, qolganlar faqat o'ziga tegishlisini
     * (`member_id` shunga majburan o'rnatiladi). Majburiy: yo'q bo'lsa 400.
     */
    @IsOptional() @Type(() => Number) @IsInt() user_id?: number;

    @IsOptional() @IsString() @MaxLength(200) search?: string;

    @IsOptional() @Type(() => Number) @IsInt() pipeline_id?: number;
    @IsOptional() @Type(() => Number) @IsInt() stage_id?: number;

    /** open = oddiy etaplar, review = tekshiruvda, done = yopilgan. */
    @IsOptional() @IsIn(['open', 'review', 'done']) state?: 'open' | 'review' | 'done';

    /** Asosiy javobgar. */
    @IsOptional() @Type(() => Number) @IsInt() responsible_id?: number;
    /** Javobgar, ishtirokchi yoki vazifani ochgan odam — "mening vazifalarim". */
    @IsOptional() @Type(() => Number) @IsInt() member_id?: number;
    @IsOptional() @Type(() => Number) @IsInt() creator_id?: number;

    /** Muddati o'tganlar. */
    @IsOptional() @Transform(toBool) overdue?: boolean;

    /** Shartnoma bo'yicha vazifalar. */
    @IsOptional() @Type(() => Number) @IsInt() contract_id?: number;
    /** Kontragent bo'yicha vazifalar (kontragent kartochkasi). */
    @IsOptional() @Type(() => Number) @IsInt() customer_id?: number;
    /** Faqat shartnomaga bog'langan vazifalar. */
    @IsOptional() @Transform(toBool) with_contract?: boolean;
}
