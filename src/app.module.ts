import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { SaasModule } from './saas/saas.module';
import { PosModule } from './pos/pos.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { StockModule } from './stock/stock.module';
import { CrmModule } from './crm/crm.module';
import { ReportsModule } from './reports/reports.module';
import { FinanceModule } from './finance/finance.module';
import { PersonnelModule } from './personnel/personnel.module';
import { OnlineOrdersModule } from './online-orders/online-orders.module';
import { QrMenuModule } from './qr-menu/qr-menu.module';
import { AiModule } from './ai/ai.module';
import { VoiceModule } from './voice/voice.module';
import { SuperAdminModule } from './superadmin/superadmin.module';
import { TenantMiddleware } from './common/middlewares/tenant.middleware';
import { HealthController } from './common/health.controller';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import stripeConfig from './config/stripe.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, stripeConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 30 },
      { name: 'long', ttl: 60000, limit: 300 },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TenantsModule,
    SaasModule,
    PosModule,
    KitchenModule,
    StockModule,
    CrmModule,
    ReportsModule,
    FinanceModule,
    PersonnelModule,
    OnlineOrdersModule,
    QrMenuModule,
    AiModule,
    VoiceModule,
    SuperAdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        'health',
        'auth/(.*)',
        'qr/(.*)',
      )
      .forRoutes('*');
  }
}
