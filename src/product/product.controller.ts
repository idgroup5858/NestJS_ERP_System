import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ImportProductDto } from './dto/import-product.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Post("add")
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @Post("import")
  importMany(@Body() importProductDto: ImportProductDto) {
    return this.productService.importMany(
      importProductDto.items,
      importProductDto.createMissingCategories,
      importProductDto.warehouseId
    );
  }

  @Get("all")
  findAll() {
    return this.productService.findAll();
  }

  @Get("allpag")
  findAllPag(
    @Query("page") page: string,
    @Query("limit") limit: string
  ) {
    return this.productService.findAllPag(+page, +limit);
  }

  @Get("allpagsearch")
  findAllPagSearch(
    @Query("page") page:string,
    @Query("limit") limit:string,
    @Query("search") search:string,
    @Query("categoryId") categoryId?:string
  ) {
    return this.productService.findAllPagSearch(+page,+limit,search,+(categoryId ?? 0) || undefined);
  }

  @Get('getby/:id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  @Patch('updateold/:id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(+id, updateProductDto);
  }



  @Patch('update/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const filename = `${Date.now()}-${file.originalname}`;
          cb(null, filename);
        },
      }),
    }),
  )
  updateWithImage(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productService.updatewithImage(+id, updateProductDto, file);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }
}
