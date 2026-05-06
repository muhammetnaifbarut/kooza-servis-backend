import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'Finansal hesaplar' })
  getAccounts(@CurrentUser('tenantId') t: string) {
    return this.financeService.getAccounts(t);
  }

  @Post('accounts')
  @Roles(UserRole.OWNER, UserRole.ACCOUNTANT)
  createAccount(@Body() dto: any, @CurrentUser('tenantId') t: string) {
    return this.financeService.createAccount(dto, t);
  }

  @Get('transactions')
  @Roles(UserRole.MANAGER, UserRole.OWNER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'İşlem listesi' })
  getTransactions(
    @CurrentUser('tenantId') t: string,
    @CurrentUser('branchId') b: string,
    @Query() query: any,
  ) {
    return this.financeService.getTransactions(t, b, query);
  }

  @Post('transactions')
  @Roles(UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Gelir/Gider gir' })
  addTransaction(
    @Body() dto: any,
    @CurrentUser('tenantId') t: string,
    @CurrentUser('branchId') b: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.financeService.addTransaction(dto, t, b, userId);
  }

  @Get('cash-register')
  @ApiOperation({ summary: 'Kasa özeti' })
  getCashRegister(@CurrentUser('branchId') b: string, @Query('date') date: string) {
    return this.financeService.getCashRegisterSummary(b, date);
  }
}
