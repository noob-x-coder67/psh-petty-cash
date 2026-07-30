import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminUser, AdminUserRole, CreateUserRequest, CreateUserResult, ResetPasswordResult } from "@psh/contracts";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import { generateTemporaryPassword, hashPassword } from "../../common/security/password";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { OrganizationRepository } from "../organization/organization.repository";
import { UsersRepository, type UserWithRolesAndUnits } from "./users.repository";

function toAdminUser(user: UserWithRolesAndUnits): AdminUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    roles: user.userRoles.map((userRole) => userRole.role.key as AdminUserRole),
    units: user.unitAccess.map((access) => access.unit),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async listUsers(): Promise<AdminUser[]> {
    const users = await this.usersRepository.list();
    return users.map(toAdminUser);
  }

  async createUser(input: CreateUserRequest, actor: AuthenticatedUser): Promise<CreateUserResult> {
    const existing = await this.usersRepository.findByEmailOrUsername(input.email, input.username);
    if (existing) {
      throw new ConflictException("A user with that email or username already exists");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await this.usersRepository.create(
        { email: input.email, username: input.username, fullName: input.fullName, passwordHash, role: input.role },
        tx,
      );
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "USER_CREATE",
        entityType: "users",
        entityId: created.id,
        unitId: null,
        after: toAdminUser(created),
      });
      return created;
    });

    return { user: toAdminUser(user), temporaryPassword };
  }

  async setUserActive(userId: string, isActive: boolean, actor: AuthenticatedUser): Promise<AdminUser> {
    const before = await this.usersRepository.findById(userId);
    if (!before) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.usersRepository.setActive(userId, isActive, tx);
      const after = await this.usersRepository.getByIdOrThrow(userId, tx);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "USER_STATUS_CHANGE",
        entityType: "users",
        entityId: userId,
        unitId: null,
        before: toAdminUser(before),
        after: toAdminUser(after),
      });
      return toAdminUser(after);
    });
  }

  async resetPassword(userId: string, actor: AuthenticatedUser): Promise<ResetPasswordResult> {
    const before = await this.usersRepository.findById(userId);
    if (!before) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    await this.prisma.$transaction(async (tx) => {
      await this.usersRepository.resetPassword(userId, passwordHash, tx);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "USER_PASSWORD_RESET",
        entityType: "users",
        entityId: userId,
        unitId: null,
      });
    });

    return { temporaryPassword };
  }

  async assignRole(userId: string, role: AdminUserRole, actor: AuthenticatedUser): Promise<AdminUser> {
    const before = await this.usersRepository.findById(userId);
    if (!before) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.usersRepository.replaceRole(userId, role, tx);
      const after = await this.usersRepository.getByIdOrThrow(userId, tx);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "USER_ROLE_CHANGE",
        entityType: "users",
        entityId: userId,
        unitId: null,
        before: toAdminUser(before),
        after: toAdminUser(after),
      });
      return toAdminUser(after);
    });
  }

  async grantUnitAccess(userId: string, unitId: string, actor: AuthenticatedUser): Promise<AdminUser> {
    const [user, unit] = await Promise.all([
      this.usersRepository.findById(userId),
      this.organizationRepository.findById(unitId),
    ]);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    if (!unit) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.usersRepository.grantUnitAccess(userId, unitId, actor.id, tx);
      const after = await this.usersRepository.getByIdOrThrow(userId, tx);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "USER_UNIT_ACCESS_GRANT",
        entityType: "user_unit_access",
        entityId: userId,
        unitId: unit.id,
        after: toAdminUser(after),
      });
      return toAdminUser(after);
    });
  }

  async revokeUnitAccess(userId: string, unitId: string, actor: AuthenticatedUser): Promise<AdminUser> {
    const before = await this.usersRepository.findById(userId);
    if (!before) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.usersRepository.revokeUnitAccess(userId, unitId, tx);
      const after = await this.usersRepository.getByIdOrThrow(userId, tx);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "USER_UNIT_ACCESS_REVOKE",
        entityType: "user_unit_access",
        entityId: userId,
        unitId,
        before: toAdminUser(before),
        after: toAdminUser(after),
      });
      return toAdminUser(after);
    });
  }
}
