import { Injectable } from "@nestjs/common";
import type { Permission, Role, RolePermission } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles(): Promise<Role[]> {
    return this.prisma.role.findMany({ orderBy: { name: "asc" } });
  }

  async listPermissions(): Promise<Permission[]> {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" } });
  }

  async listGrants(): Promise<RolePermission[]> {
    return this.prisma.rolePermission.findMany();
  }
}
