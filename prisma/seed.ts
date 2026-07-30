import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD, DEMO_USERS, PERMISSIONS, ROLE_PERMISSIONS, ROLES, UNITS } from "./seed-data";

const prisma = new PrismaClient();

// Same parameters as apps/api/src/common/security/password.ts (Build Plan §6.1 minimum:
// m=19456,t=2,p=1). Duplicated rather than imported across the prisma/ <-> apps/api
// boundary since this script is meant to stand alone.
async function hashDemoPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

async function main(): Promise<void> {
  const passwordHash = await hashDemoPassword(DEMO_PASSWORD);

  for (const unit of UNITS) {
    const row = await prisma.organizationalUnit.upsert({
      where: { code: unit.code },
      update: { name: unit.name, type: unit.type, city: unit.city, pettyCashEnabled: unit.pettyCashEnabled },
      create: unit,
    });

    // Appendix E: "Seed active petty-cash units for [the 9 units] ... Seed PSH-ISB ...
    // with petty_cash_enabled=false and no account" — the explicit "no account" callout
    // for PSH-ISB implies the other 9 do get one. Starts at zero balance/float; Finance
    // sets the real approved float via the app's own allocation workflow, not the seed.
    if (unit.pettyCashEnabled) {
      await prisma.pettyCashAccount.upsert({
        where: { unitId: row.id },
        update: {},
        create: { unitId: row.id },
      });
    }
  }

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name },
      create: role,
    });
  }

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  const expectedGrants = new Set<string>();
  for (const [permissionKey, roleKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
    for (const roleKey of roleKeys) {
      const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
      expectedGrants.add(`${role.id}:${permission.id}`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // The loop above only ever grants — a role removed from ROLE_PERMISSIONS for a given
  // permission (e.g. narrowing admin.manage_users_units to SUPER_ADMIN only) would
  // otherwise leave its old grant sitting in the database forever across re-seeds. Prune
  // anything not in the current mapping so the seed is idempotent both ways.
  const existingGrants = await prisma.rolePermission.findMany({ select: { roleId: true, permissionId: true } });
  for (const grant of existingGrants) {
    if (!expectedGrants.has(`${grant.roleId}:${grant.permissionId}`)) {
      await prisma.rolePermission.delete({
        where: { roleId_permissionId: { roleId: grant.roleId, permissionId: grant.permissionId } },
      });
    }
  }

  // Bootstrap actor for user_unit_access.granted_by — created first so later grants can
  // reference it.
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@psh.local" },
    update: { passwordHash },
    create: {
      email: "superadmin@psh.local",
      username: "superadmin",
      fullName: "Super Admin",
      passwordHash,
    },
  });

  for (const demoUser of DEMO_USERS) {
    const user =
      demoUser.email === superAdmin.email
        ? superAdmin
        : await prisma.user.upsert({
            where: { email: demoUser.email },
            update: { username: demoUser.username, fullName: demoUser.fullName, passwordHash },
            create: {
              email: demoUser.email,
              username: demoUser.username,
              fullName: demoUser.fullName,
              passwordHash,
            },
          });

    const role = await prisma.role.findUniqueOrThrow({ where: { key: demoUser.role } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    for (const unitCode of demoUser.unitCodes) {
      const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: unitCode } });
      await prisma.userUnitAccess.upsert({
        where: { userId_unitId: { userId: user.id, unitId: unit.id } },
        update: {},
        create: { userId: user.id, unitId: unit.id, grantedBy: superAdmin.id },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
