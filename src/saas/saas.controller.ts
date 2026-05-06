import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SaasService } from './saas.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Public } from '../common/decorators/roles.decorator';

@ApiTags('saas')
@Controller('saas')
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  @Public()
  @Get('plans')
  getPlans() { return this.saasService.getPlans(); }

  @ApiBearerAuth()
  @Get('subscription')
  getSubscription(@CurrentUser('tenantId') t: string) { return this.saasService.getSubscription(t); }

  @ApiBearerAuth()
  @Get('license')
  checkLicense(@CurrentUser('tenantId') t: string) { return this.saasService.checkLicense(t); }
}
