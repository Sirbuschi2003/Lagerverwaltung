import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { AccessControlService } from "../access-control.service";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

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

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user;
    if (!user) return false;

    // SUPER_ADMIN (branchId === null) hat alle Rechte — kein DB-Lookup nötig
    if (user.branchId === null) return true;

    const effective = await this.accessControlService.getEffectivePermissionsForUser(user.id, user.role);
    const set = new Set(effective);
    const missing = required.filter((perm) => !set.has(perm));
    if (missing.length === 0) return true;

    // Klare, konkrete Meldung statt der generischen NestJS-Standardmeldung
    // "Forbidden resource" - damit im Frontend sichtbar wird, WARUM eine
    // Aktion fehlschlug, statt dass sie scheinbar wirkungslos verpufft.
    const missingLabels = await this.accessControlService.describePermissions(missing);
    throw new ForbiddenException(`Fehlende Berechtigung: ${missingLabels.join(", ")}`);
  }
}
