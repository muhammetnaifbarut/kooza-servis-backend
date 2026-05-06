import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard anlık istatistikler' })
  getDashboard(@CurrentUser('tenantId') t: string, @CurrentUser('branchId') b: string) {
    return this.reportsService.getDashboardStats(t, b);
  }

  @Get('sales')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Satış raporu' })
  getSales(
    @CurrentUser('tenantId') t: string,
    @CurrentUser('branchId') b: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    return this.reportsService.getSalesReport(t, b, startDate || today, endDate || today);
  }

  @Get('branches')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Şube karşılaştırma raporu' })
  getBranchComparison(
    @CurrentUser('tenantId') t: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    return this.reportsService.getBranchComparison(t, startDate || today, endDate || today);
  }

  @Get('personnel')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Personel performans raporu' })
  getPersonnel(
    @CurrentUser('branchId') b: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    return this.reportsService.getPersonnelPerformance(b, startDate || today, endDate || today);
  }
}
