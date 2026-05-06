import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllCategories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId, parentId: null, isActive: true },
      include: {
        children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { products: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto, tenantId: string) {
    return this.prisma.category.create({
      data: { ...dto, tenantId },
    });
  }

  async findAll(tenantId: string, query: any) {
    const where: any = {
      tenantId,
      isActive: true,
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.type && { type: query.type }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { barcode: { contains: query.search } },
          { sku: { contains: query.search } },
        ],
      }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true, color: true } },
          _count: { select: { recipe: true } },
        },
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        take: query.limit || 200,
        skip: query.offset || 0,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products, total };
  }

  async findOne(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        recipe: { include: { ingredient: true } },
        modifierGroups: { include: { group: { include: { options: true } } } },
      },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı');
    return product;
  }

  async create(dto: CreateProductDto, tenantId: string) {
    const { recipe, ...productData } = dto;
    const product = await this.prisma.product.create({
      data: { ...productData, tenantId },
    });

    if (recipe && recipe.length > 0) {
      await this.prisma.recipeItem.createMany({
        data: recipe.map((r) => ({
          productId: product.id,
          ingredientId: r.ingredientId,
          quantity: r.quantity,
          unit: r.unit,
        })),
      });
    }

    return this.findOne(product.id, tenantId);
  }

  async update(id: string, dto: UpdateProductDto, tenantId: string) {
    await this.findOne(id, tenantId);
    const { recipe, ...productData } = dto;

    await this.prisma.product.update({ where: { id }, data: productData });

    if (recipe) {
      await this.prisma.recipeItem.deleteMany({ where: { productId: id } });
      if (recipe.length > 0) {
        await this.prisma.recipeItem.createMany({
          data: recipe.map((r) => ({
            productId: id,
            ingredientId: r.ingredientId,
            quantity: r.quantity,
            unit: r.unit,
          })),
        });
      }
    }

    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async toggleAvailability(id: string, tenantId: string) {
    const product = await this.findOne(id, tenantId);
    return this.prisma.product.update({
      where: { id },
      data: { isAvailable: !product.isAvailable },
    });
  }
}
