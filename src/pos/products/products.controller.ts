import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('pos')
@ApiBearerAuth()
@Controller('pos/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('categories')
  findCategories(@CurrentUser('tenantId') tenantId: string) {
    return this.productsService.findAllCategories(tenantId);
  }

  @Post('categories')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  createCategory(@Body() dto: CreateCategoryDto, @CurrentUser('tenantId') tenantId: string) {
    return this.productsService.createCategory(dto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Ürün listesi' })
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: any) {
    return this.productsService.findAll(tenantId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.productsService.findOne(id, tenantId);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  create(@Body() dto: CreateProductDto, @CurrentUser('tenantId') tenantId: string) {
    return this.productsService.create(dto, tenantId);
  }

  @Put(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser('tenantId') tenantId: string) {
    return this.productsService.update(id, dto, tenantId);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  toggle(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.productsService.toggleAvailability(id, tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  delete(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.productsService.delete(id, tenantId);
  }
}
