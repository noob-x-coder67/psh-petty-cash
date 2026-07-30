import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../types/authenticated-user";

// Roles whose scope spans every petty-cash-enabled unit rather than an enumerated list —
// SRS §6.2 ("Finance and Super Admin may access all petty-cash units") plus Appendix E's
// "Auditor | Read-only all units". UNIT_USER / UNIT_INCHARGE / SUPPORT are not in this
// set, so their scope is whatever user_unit_access enumerates (empty for SUPPORT today).
const ALL_UNIT_SCOPE_ROLES = new Set(["SUPER_ADMIN", "FINANCE_MANAGER", "FINANCE_OFFICER", "AUDITOR"]);

export type AuthContextResult =
  | { found: false }
  | {
      found: true;
      isActive: boolean;
      lockedUntil: Date | null;
      failedLoginCount: number;
      passwordHash: string;
      context: AuthenticatedUser;
    };

@Injectable()
export class AuthContextRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadByEmail(email: string): Promise<AuthContextResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { found: false };
    }
    return this.buildResult(user.id);
  }

  async loadById(userId: string): Promise<AuthContextResult> {
    return this.buildResult(userId);
  }

  private async buildResult(userId: string): Promise<AuthContextResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
        unitAccess: { select: { unitId: true } },
      },
    });

    if (!user) {
      return { found: false };
    }

    const roleKeys = user.userRoles.map((userRole) => userRole.role.key);
    const permissionKeys = [
      ...new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.key),
        ),
      ),
    ];
    const allUnitScope = roleKeys.some((key) => ALL_UNIT_SCOPE_ROLES.has(key));

    return {
      found: true,
      isActive: user.isActive,
      lockedUntil: user.lockedUntil,
      failedLoginCount: user.failedLoginCount,
      passwordHash: user.passwordHash,
      context: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        mustChangePassword: user.mustChangePassword,
        roleKeys,
        permissionKeys,
        unitScope: {
          all: allUnitScope,
          unitIds: user.unitAccess.map((access) => access.unitId),
        },
      },
    };
  }
}
