import {
  Controller, Get, Patch, Delete, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SuperAdminService } from './superadmin.service';

@Controller('superadmin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  // ── Genel Bakış ────────────────────────────────────────────

  @Get('overview')
  getOverview() {
    return this.superAdminService.getOverview();
  }

  // ── İşletmeler ─────────────────────────────────────────────

  @Get('tenants')
  listTenants(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.superAdminService.listTenants({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status,
    });
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.superAdminService.getTenantDetail(id);
  }

  @Patch('tenants/:id/activate')
  activateTenant(@Param('id') id: string) {
    return this.superAdminService.setTenantActive(id, true);
  }

  @Patch('tenants/:id/deactivate')
  deactivateTenant(@Param('id') id: string) {
    return this.superAdminService.setTenantActive(id, false);
  }

  @Delete('tenants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTenant(@Param('id') id: string) {
    return this.superAdminService.deleteTenant(id);
  }

  // ── Abonelikler ────────────────────────────────────────────

  @Get('subscriptions')
  listSubscriptions(@Query('status') status?: string) {
    return this.superAdminService.listSubscriptions(status);
  }

  @Patch('subscriptions/:tenantId')
  updateSubscription(
    @Param('tenantId') tenantId: string,
    @Body() dto: { planId?: string; status?: string; expiresAt?: string },
  ) {
    return this.superAdminService.updateSubscription(tenantId, dto);
  }

  // ── Planlar ────────────────────────────────────────────────

  @Get('plans')
  listPlans() {
    return this.superAdminService.listPlans();
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: any) {
    return this.superAdminService.updatePlan(id, dto);
  }

  // ── Gelir İstatistikleri ───────────────────────────────────

  @Get('revenue')
  getRevenue(@Query('period') period: 'week' | 'month' | 'year' = 'month') {
    return this.superAdminService.getRevenue(period);
  }

  // ── Kullanıcılar ───────────────────────────────────────────

  @Get('users')
  listAllUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('role') role?: string,
  ) {
    return this.superAdminService.listAllUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      role,
    });
  }
}
