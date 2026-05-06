import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CrmService } from './crm.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('crm')
@ApiBearerAuth()
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('customers')
  @ApiOperation({ summary: 'Müşteri listesi' })
  findAll(@CurrentUser('tenantId') t: string, @Query() q: any) {
    return this.crmService.findAllCustomers(t, q);
  }

  @Get('customers/stats')
  getStats(@CurrentUser('tenantId') t: string) {
    return this.crmService.getCustomerStats(t);
  }

  @Get('customers/:id')
  findOne(@Param('id') id: string, @CurrentUser('tenantId') t: string) {
    return this.crmService.findOneCustomer(id, t);
  }

  @Post('customers')
  create(@Body() dto: any, @CurrentUser('tenantId') t: string) {
    return this.crmService.createCustomer(dto, t);
  }

  @Put('customers/:id')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser('tenantId') t: string) {
    return this.crmService.updateCustomer(id, dto, t);
  }

  @Post('loyalty/earn')
  earnPoints(
    @Body() body: { customerId: string; orderId: string },
    @CurrentUser('tenantId') t: string,
  ) {
    return this.crmService.earnPoints(body.customerId, body.orderId, t);
  }

  @Post('loyalty/redeem')
  redeemPoints(
    @Body() body: { customerId: string; points: number; orderId: string },
    @CurrentUser('tenantId') t: string,
  ) {
    return this.crmService.redeemPoints(body.customerId, body.points, body.orderId, t);
  }

  @Get('campaigns')
  getCampaigns(@CurrentUser('tenantId') t: string) {
    return this.crmService.findCampaigns(t);
  }

  @Post('campaigns')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  createCampaign(@Body() dto: any, @CurrentUser('tenantId') t: string) {
    return this.crmService.createCampaign(dto, t);
  }

  @Put('campaigns/:id')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  updateCampaign(@Param('id') id: string, @Body() dto: any, @CurrentUser('tenantId') t: string) {
    return this.crmService.updateCampaign(id, dto, t);
  }

  @Get('campaigns/active')
  getActiveCampaigns(@CurrentUser('tenantId') t: string, @Query('amount') amount: number) {
    return this.crmService.getActiveCampaigns(t, amount || 0);
  }
}
