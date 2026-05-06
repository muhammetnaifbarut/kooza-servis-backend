import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface TenantRequest extends Request {
  tenantId?: string;
  tenant?: any;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    // Tenant identification strategies:
    // 1. X-Tenant-ID header (for API clients)
    // 2. Subdomain (e.g., slug.hizmetkasa.com)
    // 3. Custom domain

    const tenantId = req.headers['x-tenant-id'] as string;
    const tenantSlug = req.headers['x-tenant-slug'] as string;
    const host = req.headers['host'] as string;

    // Skip for public routes
    const publicPaths = ['/api/v1/auth/register', '/api/v1/saas', '/api/v1/health'];
    if (publicPaths.some((p) => req.path.startsWith(p))) {
      return next();
    }

    try {
      if (tenantId) {
        const tenant = await this.prisma.tenant.findFirst({
          where: { id: tenantId, isActive: true },
          select: { id: true, slug: true, name: true, currency: true, timezone: true },
        });
        if (tenant) {
          req.tenantId = tenant.id;
          req.tenant = tenant;
        }
      } else if (tenantSlug) {
        const tenant = await this.prisma.tenant.findFirst({
          where: { slug: tenantSlug, isActive: true },
          select: { id: true, slug: true, name: true, currency: true, timezone: true },
        });
        if (tenant) {
          req.tenantId = tenant.id;
          req.tenant = tenant;
        }
      } else if (host) {
        // Check subdomain
        const subdomain = host.split('.')[0];
        const tenant = await this.prisma.tenant.findFirst({
          where: {
            OR: [{ slug: subdomain }, { domain: host }],
            isActive: true,
          },
          select: { id: true, slug: true, name: true, currency: true, timezone: true },
        });
        if (tenant) {
          req.tenantId = tenant.id;
          req.tenant = tenant;
        }
      }
    } catch (err) {
      // Continue without tenant context — guards will reject if needed
    }

    next();
  }
}
