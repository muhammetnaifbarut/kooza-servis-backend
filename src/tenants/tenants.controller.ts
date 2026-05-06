import { Controller, Get, Put, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  getMyTenant(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.findOne(tenantId);
  }

  @Put('me')
  @Roles(UserRole.OWNER)
  updateTenant(@CurrentUser('tenantId') tenantId: string, @Body() dto: any) {
    return this.tenantsService.update(tenantId, dto);
  }

  @Put('me/settings')
  @Roles(UserRole.OWNER)
  updateSettings(@CurrentUser('tenantId') tenantId: string, @Body() dto: any) {
    return this.tenantsService.updateSettings(tenantId, dto);
  }

  @Get('me/branches')
  getBranches(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.getBranches(tenantId);
  }

  @Post('me/branches')
  @Roles(UserRole.OWNER)
  createBranch(@CurrentUser('tenantId') tenantId: string, @Body() dto: any) {
    return this.tenantsService.createBranch(tenantId, dto);
  }

  @Get('me/users')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  getUsers(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.getUsers(tenantId);
  }

  @Post('me/users')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  createUser(@CurrentUser('tenantId') tenantId: string, @Body() dto: any) {
    return this.tenantsService.createUser(tenantId, dto);
  }

  @Put('me/users/:id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  updateUser(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @Body() dto: any) {
    return this.tenantsService.updateUser(id, tenantId, dto);
  }
}
