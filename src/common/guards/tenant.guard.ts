import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant bilgisi bulunamadı');
    }

    // Ensure user belongs to this tenant (except SUPER_ADMIN)
    if (user && user.role !== 'SUPER_ADMIN' && user.tenantId !== tenantId) {
      throw new ForbiddenException('Bu işletmeye erişim yetkiniz yok');
    }

    return true;
  }
}
