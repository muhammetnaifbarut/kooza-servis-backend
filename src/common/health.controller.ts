import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './decorators/roles.decorator';

/**
 * Health check endpoint — UptimeRobot/Vercel monitoring için
 * GET /api/v1/health
 */
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    const start = Date.now();
    const checks: Record<string, any> = {};
    let ok = true;

    // DB
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true, ms: Date.now() - start };
    } catch (err) {
      checks.database = { ok: false, error: 'Connection failed' };
      ok = false;
    }

    // JWT secret
    checks.jwt = {
      ok: !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16,
    };
    if (!checks.jwt.ok) ok = false;

    // AI (soft fail)
    checks.ai = {
      ok: !!process.env.ANTHROPIC_API_KEY,
      mode: process.env.ANTHROPIC_API_KEY ? 'enabled' : 'disabled',
    };

    return {
      status: ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      checks,
      responseTimeMs: Date.now() - start,
    };
  }
}
