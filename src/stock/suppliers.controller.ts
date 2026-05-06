import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stock/suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get() findAll(@CurrentUser('tenantId') t: string) { return this.service.findAll(t); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser('tenantId') t: string) { return this.service.findOne(id, t); }
  @Post() @Roles(UserRole.MANAGER, UserRole.OWNER) create(@Body() dto: any, @CurrentUser('tenantId') t: string) { return this.service.create(dto, t); }
  @Put(':id') @Roles(UserRole.MANAGER, UserRole.OWNER) update(@Param('id') id: string, @Body() dto: any, @CurrentUser('tenantId') t: string) { return this.service.update(id, dto, t); }
  @Delete(':id') @Roles(UserRole.MANAGER, UserRole.OWNER) delete(@Param('id') id: string, @CurrentUser('tenantId') t: string) { return this.service.delete(id, t); }
}
