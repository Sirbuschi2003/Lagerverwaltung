import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AccessControlService } from "../access-control.service";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControlService: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;

    // SUPER_ADMIN (branchId === null) hat alle Rechte — kein DB-Lookup nötig
    if (user.branchId === null) return true;

    const effective = await this.accessControlService.getEffectivePermissionsForUser(user.id, user.role);
    const set = new Set(effective);
    return required.every((perm) => set.has(perm));
  }
}
