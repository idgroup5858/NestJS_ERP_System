import { ArrayMaxSize, ArrayNotEmpty, IsArray } from "class-validator";

export class ImportCategoryItemDto {
    name: string;
}

export class ImportCategoryDto {

    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(500)
    items: ImportCategoryItemDto[];
}
