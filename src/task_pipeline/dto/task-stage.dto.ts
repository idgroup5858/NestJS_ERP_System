import { Transform } from "class-transformer";
import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { STAGE_COLORS } from "../task-stages";
import type { StageColor } from "../task-stages";
import { trim } from "./create-task_pipeline.dto";

/** Faqat oddiy (normal) etap qo'shiladi: "На проверке" va "Закрыта" har jarayonda bittadan. */
export class CreateTaskStageDto {

    @IsInt()
    @Min(1)
    pipeline_id: number;

    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите название этапа' })
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsIn(STAGE_COLORS)
    color?: StageColor;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(10_000)
    order_id?: number;
}

export class UpdateTaskStageDto {

    @IsOptional()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Укажите название этапа' })
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsIn(STAGE_COLORS)
    color?: StageColor;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(10_000)
    order_id?: number;
}

/** Oddiy etaplarni yangi tartibda yuboradi: `ids` — jarayondagi barcha oddiy etaplar. */
export class ReorderTaskStagesDto {

    @IsInt()
    @Min(1)
    pipeline_id: number;

    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @IsInt({ each: true })
    ids: number[];
}
