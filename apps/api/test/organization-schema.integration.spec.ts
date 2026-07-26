import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_USERS, PERMISSIONS, ROLE_PERMISSIONS, ROLES, UNITS } from "../../../prisma/seed";

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL — this suite only reads/probes, it does not seed.
const prisma = new PrismaClient();

const TOTAL_ROLE_PERMISSIONS = Object.values(ROLE_PERMISSIONS).reduce((sum, roles) => sum + roles.length, 0);

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("PSH-ISB exclusion (BR-016, R-11)", () => {
  it("rejects enabling petty_cash_enabled for PSH-ISB via Prisma", async () => {
    await expect(
      prisma.organizationalUnit.update({
        where: { code: "PSH-ISB" },
        data: { pettyCashEnabled: true },
      }),
    ).rejects.toThrow();
  });

  it("rejects enabling petty_cash_enabled for PSH-ISB via raw SQL", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        "UPDATE organizational_units SET petty_cash_enabled = true WHERE code = 'PSH-ISB'",
      ),
    ).rejects.toThrow();
  });

  it("confirms PSH-ISB is still disabled after both rejected attempts", async () => {
    const pshIsb = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-ISB" } });
    expect(pshIsb.pettyCashEnabled).toBe(false);
  });

  it("uq_unit_id_pce exists as a real UNIQUE CONSTRAINT, not just an index", async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ contype: string }>>(
      "SELECT contype FROM pg_constraint WHERE conname = 'uq_unit_id_pce'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.contype).toBe("u");
  });
});

describe("uniqueness constraints", () => {
  it("rejects a duplicate organizational_units.code", async () => {
    await expect(
      prisma.organizationalUnit.create({
        data: { code: "PSH-ISB", name: "duplicate", type: "CENTER", pettyCashEnabled: false },
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate users.email", async () => {
    await expect(
      prisma.user.create({
        data: {
          email: "superadmin@psh.local",
          username: "not-a-duplicate-username",
          fullName: "duplicate",
          passwordHash: "x",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate users.username", async () => {
    await expect(
      prisma.user.create({
        data: {
          email: "not-a-duplicate-email@psh.local",
          username: "superadmin",
          fullName: "duplicate",
          passwordHash: "x",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate roles.key", async () => {
    await expect(
      prisma.role.create({ data: { key: "SUPER_ADMIN", name: "duplicate" } }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate permissions.key", async () => {
    await expect(
      prisma.permission.create({ data: { key: "dashboard.view_own_unit", description: "duplicate" } }),
    ).rejects.toThrow();
  });
});

describe("seed shape (Appendix E / Appendix A)", () => {
  it("seeds exactly the units in Appendix E", async () => {
    const count = await prisma.organizationalUnit.count();
    expect(count).toBe(UNITS.length);
  });

  it("seeds exactly the 7 role_key values", async () => {
    const count = await prisma.role.count();
    expect(count).toBe(ROLES.length);
  });

  it("seeds exactly the Appendix A permission set", async () => {
    const count = await prisma.permission.count();
    expect(count).toBe(PERMISSIONS.length);
  });

  it("seeds the exact role_permissions mapping derived from Appendix A", async () => {
    const count = await prisma.rolePermission.count();
    expect(count).toBe(TOTAL_ROLE_PERMISSIONS);
  });

  it("seeds exactly the Appendix E demo users", async () => {
    const count = await prisma.user.count();
    expect(count).toBe(DEMO_USERS.length);
  });

  it.each(DEMO_USERS.filter((u) => u.unitCodes.length > 0))(
    "grants $email user_unit_access to exactly its Appendix E unit scope",
    async (demoUser) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: demoUser.email },
        include: { unitAccess: { include: { unit: true } } },
      });
      const grantedCodes = user.unitAccess.map((access) => access.unit.code).sort();
      expect(grantedCodes).toEqual([...demoUser.unitCodes].sort());
    },
  );

  it("Super Admin and Auditor have no enumerated user_unit_access rows (scope derived from role)", async () => {
    const allUnitScopedUsers = await prisma.user.findMany({
      where: { email: { in: ["superadmin@psh.local", "auditor@psh.local"] } },
      include: { unitAccess: true },
    });
    for (const user of allUnitScopedUsers) {
      expect(user.unitAccess).toHaveLength(0);
    }
  });
});
