import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";

// Read-only (GET /admin/roles) — no mutations, so no audit-row assertions here, unlike
// admin-units.integration.spec.ts/admin-users.integration.spec.ts.

let app: INestApplication;
const sessions = new Map<string, string[]>();

function extractCookies(res: request.Response): string[] {
  const raw = res.headers["set-cookie"] as unknown;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return [raw];
  return [];
}

async function loginAs(email: string): Promise<string[]> {
  const cached = sessions.get(email);
  if (cached) return cached;
  const res = await request(app.getHttpServer()).post("/auth/login").send({ email, password: DEMO_PASSWORD }).expect(200);
  const cookies = extractCookies(res);
  sessions.set(email, cookies);
  return cookies;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe("GET /admin/roles — permission gate (admin.manage_unit_access)", () => {
  it("Finance Officer gets 403 — has neither admin permission", async () => {
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer()).get("/admin/roles").set("Cookie", cookies).expect(403);
  });

  it("Finance Manager gets 200 — Limited admin grant includes viewing the matrix", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer()).get("/admin/roles").set("Cookie", cookies).expect(200);
  });

  it("Super Admin gets 200 with the full seeded matrix (Appendix A, prisma/seed-data.ts)", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const res = await request(app.getHttpServer()).get("/admin/roles").set("Cookie", cookies).expect(200);

    const roleKeys = res.body.roles.map((role: { key: string }) => role.key);
    expect(roleKeys).toEqual(
      expect.arrayContaining(["SUPER_ADMIN", "FINANCE_MANAGER", "FINANCE_OFFICER", "UNIT_USER", "UNIT_INCHARGE", "AUDITOR", "SUPPORT"]),
    );

    const permissionKeys = res.body.permissions.map((permission: { key: string }) => permission.key);
    expect(permissionKeys).toEqual(
      expect.arrayContaining(["admin.manage_users_units", "admin.manage_unit_access", "category.manage"]),
    );

    const categoryPermission = res.body.permissions.find(
      (permission: { key: string }) => permission.key === "category.manage",
    );
    expect(categoryPermission.enforced).toBe(true);

    const categoryGrantees = res.body.grants
      .filter((grant: { permissionKey: string }) => grant.permissionKey === "category.manage")
      .map((grant: { roleKey: string }) => grant.roleKey)
      .sort();
    expect(categoryGrantees).toEqual(["FINANCE_MANAGER", "SUPER_ADMIN"]);

    // admin.manage_users_units is Super-Admin-only (BR-016 unit-management split, Phase
    // 1 of this Administration effort) — Finance Manager must not appear as a grantee.
    const usersUnitsGrantees = res.body.grants
      .filter((grant: { permissionKey: string }) => grant.permissionKey === "admin.manage_users_units")
      .map((grant: { roleKey: string }) => grant.roleKey);
    expect(usersUnitsGrantees).toEqual(["SUPER_ADMIN"]);

    // admin.manage_unit_access is shared (Finance Manager + Super Admin).
    const unitAccessGrantees = res.body.grants
      .filter((grant: { permissionKey: string }) => grant.permissionKey === "admin.manage_unit_access")
      .map((grant: { roleKey: string }) => grant.roleKey)
      .sort();
    expect(unitAccessGrantees).toEqual(["FINANCE_MANAGER", "SUPER_ADMIN"]);
  });
});
