import { Injectable } from "@nestjs/common";
import { Prisma, type RoleKey, type User } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

type Client = PrismaService | Prisma.TransactionClient;

const USER_INCLUDE = {
  userRoles: { include: { role: true } },
  unitAccess: { include: { unit: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.UserInclude;

export type UserWithRolesAndUnits = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

export interface CreateUserParams {
  email: string;
  username: string;
  fullName: string;
  passwordHash: string;
  role: RoleKey;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<UserWithRolesAndUnits[]> {
    return this.prisma.user.findMany({ include: USER_INCLUDE, orderBy: { fullName: "asc" } });
  }

  async findById(id: string, client: Client = this.prisma): Promise<UserWithRolesAndUnits | null> {
    return client.user.findUnique({ where: { id }, include: USER_INCLUDE });
  }

  // For re-reading a row this same transaction just wrote — genuinely can't be missing,
  // so a throw (not null) is the right shape for the caller.
  async getByIdOrThrow(id: string, client: Client = this.prisma): Promise<UserWithRolesAndUnits> {
    return client.user.findUniqueOrThrow({ where: { id }, include: USER_INCLUDE });
  }

  async findByEmailOrUsername(email: string, username: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  }

  async create(params: CreateUserParams, client: Client = this.prisma): Promise<UserWithRolesAndUnits> {
    const role = await client.role.findUniqueOrThrow({ where: { key: params.role } });
    return client.user.create({
      data: {
        email: params.email,
        username: params.username,
        fullName: params.fullName,
        passwordHash: params.passwordHash,
        mustChangePassword: true,
        userRoles: { create: { roleId: role.id } },
      },
      include: USER_INCLUDE,
    });
  }

  async setActive(userId: string, isActive: boolean, client: Client = this.prisma): Promise<User> {
    return client.user.update({ where: { id: userId }, data: { isActive } });
  }

  // Admin-initiated reset always forces a change on next login — distinct from
  // AuthRepository.updatePasswordAndClearMustChange (self-service), which always clears it.
  async resetPassword(userId: string, passwordHash: string, client: Client = this.prisma): Promise<void> {
    await client.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } });
  }

  // A user has exactly one active role in practice (see AdminUserSchema's note in
  // packages/contracts) — replaces whatever role rows exist rather than adding to them.
  async replaceRole(userId: string, role: RoleKey, client: Client = this.prisma): Promise<void> {
    const roleRow = await client.role.findUniqueOrThrow({ where: { key: role } });
    await client.userRole.deleteMany({ where: { userId } });
    await client.userRole.create({ data: { userId, roleId: roleRow.id } });
  }

  async grantUnitAccess(userId: string, unitId: string, grantedBy: string, client: Client = this.prisma): Promise<void> {
    await client.userUnitAccess.upsert({
      where: { userId_unitId: { userId, unitId } },
      update: {},
      create: { userId, unitId, grantedBy },
    });
  }

  async revokeUnitAccess(userId: string, unitId: string, client: Client = this.prisma): Promise<void> {
    await client.userUnitAccess.deleteMany({ where: { userId, unitId } });
  }
}
