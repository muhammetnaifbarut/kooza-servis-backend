import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('pos')
@ApiBearerAuth()
@Controller('pos/tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @ApiOperation({ summary: 'Masa listesi' })
  findAll(@CurrentUser('branchId') branchId: string, @CurrentUser('tenantId') tenantId: string) {
    return this.tablesService.findAll(branchId, tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('branchId') branchId: string) {
    return this.tablesService.findOne(id, branchId);
  }

  @Get(':id/qr')
  generateQr(@Param('id') id: string, @CurrentUser('branchId') branchId: string) {
    return this.tablesService.generateQr(id, branchId);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  create(@Body() dto: CreateTableDto, @CurrentUser('branchId') branchId: string) {
    return this.tablesService.create(dto, branchId);
  }

  @Put(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.tablesService.update(id, dto, branchId);
  }

  @Patch('layout')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  updateLayout(
    @CurrentUser('branchId') branchId: string,
    @Body() body: { tables: { id: string; posX: number; posY: number }[] },
  ) {
    return this.tablesService.updateLayout(branchId, body.tables);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.tablesService.updateStatus(id, status, branchId);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  delete(@Param('id') id: string, @CurrentUser('branchId') branchId: string) {
    return this.tablesService.delete(id, branchId);
  }
}
