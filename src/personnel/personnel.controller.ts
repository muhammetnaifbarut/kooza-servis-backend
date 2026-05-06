import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { PersonnelService } from './personnel.service';

@Controller('personnel')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PersonnelController {
  constructor(private readonly personnelService: PersonnelService) {}

  // ── Personel Listesi ───────────────────────────────────────

  @Get()
  @Roles('SUPER_ADMIN', 'OWNER', 'MANAGER')
  getPersonnel(@TenantId() tenantId: string, @Query('branchId') branchId?: string) {
    return this.personnelService.getPersonnel(tenantId, branchId);
  }

  // ── Vardiya ────────────────────────────────────────────────

  @Post('shifts/open')
  openShift(
    @CurrentUser() user: any,
    @Body() dto: { openingCash: number; note?: string },
  ) {
    return this.personnelService.openShift(user.branchId, user.sub, dto.openingCash, dto.note);
  }

  @Patch('shifts/:id/close')
  closeShift(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: { closingCash: number },
  ) {
    return this.personnelService.closeShift(id, user.branchId, dto.closingCash);
  }

  @Get('shifts/current')
  getCurrentShift(@CurrentUser() user: any) {
    return this.personnelService.getCurrentShift(user.branchId, user.sub);
  }

  @Get('shifts')
  @Roles('SUPER_ADMIN', 'OWNER', 'MANAGER')
  getShifts(
    @CurrentUser() user: any,
    @Query('date') date?: string,
    @Query('userId') userId?: string,
  ) {
    return this.personnelService.getShifts(user.branchId, { date, userId });
  }

  // ── Mola ───────────────────────────────────────────────────

  @Post('shifts/:shiftId/break/start')
  startBreak(@Param('shiftId') shiftId: string, @CurrentUser() user: any) {
    return this.personnelService.startBreak(shiftId, user.sub);
  }

  @Patch('break/:entryId/end')
  endBreak(@Param('entryId') entryId: string) {
    return this.personnelService.endBreak(entryId);
  }

  // ── Raporlar ───────────────────────────────────────────────

  @Get('reports/work-hours')
  @Roles('SUPER_ADMIN', 'OWNER', 'MANAGER')
  getWorkHoursReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.personnelService.getWorkHoursReport(user.branchId, startDate, endDate);
  }
}
