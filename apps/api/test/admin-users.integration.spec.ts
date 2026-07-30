import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL. Proves the admin.manage_users_units (Super Admin only) /
// admin.manage_unit_access (Finance Manager + Super Admin) split actually holds at the
// HTTP layer, and that the temp-password create/reset -> forced change-password loop is
// genuinely usable end to end, not just internally consistent.

let app: INestApplication;
let prisma: PrismaService;
const sessions = new Map<string, string[]>();

function extractCookies(res: request.Response): string[] {
  const raw = res.headers["set-cookie"] as unknown;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return [raw];
  return [];
}

async function loginAs(email: string, password = DEMO_PASSWORD): Promise<string[]> {
  const cacheKey = `${email}:${password}`;
  const cached = sessions.get(cacheKey);
  if (cached) return cached;
  const res = await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(200);
  const cookies = extractCookies(res);
  sessions.set(cacheKey, cookies);
  return cookies;
}

// change-password is CSRF-guarded like every other state-changing /auth/* route
// (double-submit pattern) — the cookie alone isn't enough, the header has to match it.
function csrfTokenFrom(cookies: string[]): string {
  return (
    cookies
      .map((c) => c.split(";")[0])
      .find((c) => c?.startsWith("psh_csrf_token="))
      ?.split("=")[1] ?? ""
  );
}

// A UUID-suffixed unit code that can never collide with a real seeded unit — used only
// to confirm the unit-access grant/revoke endpoints round-trip; never actually enables
// petty cash or touches Appendix E's real 10 units.
async function findAnyUnit(): Promise<{ id: string; code: string }> {
  const unit = await prisma.organizationalUnit.findFirstOrThrow({ where: { code: "PSH-SOH" } });
  return unit;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

describe("GET /admin/users — permission gate", () => {
  it("Finance Officer (holds neither admin key) gets 403", async () => {
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer()).get("/admin/users").set("Cookie", cookies).expect(403);
  });

  it("Finance Manager (holds admin.manage_unit_access) gets 200", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer()).get("/admin/users").set("Cookie", cookies).expect(200);
  });

  it("Super Admin gets 200", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    await request(app.getHttpServer()).get("/admin/users").set("Cookie", cookies).expect(200);
  });
});

describe("POST /admin/users — Super-Admin-only account lifecycle", () => {
  it("Finance Manager (Limited per Appendix A) gets 403 creating a user", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post("/admin/users")
      .set("Cookie", cookies)
      .send({
        email: `probe-${randomUUID()}@psh.local`,
        username: `probe-${randomUUID()}`,
        fullName: "Probe User",
        role: "UNIT_USER",
      })
      .expect(403);
  });

  it("Finance Officer gets 403 creating a user", async () => {
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer())
      .post("/admin/users")
      .set("Cookie", cookies)
      .send({
        email: `probe-${randomUUID()}@psh.local`,
        username: `probe-${randomUUID()}`,
        fullName: "Probe User",
        role: "UNIT_USER",
      })
      .expect(403);
  });
});

describe("full lifecycle: create (UNIT_INCHARGE — no prior demo account for this role) -> temp password login -> forced change -> role change -> unit access grant/revoke -> deactivate", () => {
  const marker = randomUUID();
  const email = `incharge-${marker}@psh.local`;
  const username = `incharge-${marker}`;
  let userId: string;
  let temporaryPassword: string;

  afterAll(async () => {
    // No DELETE endpoint exists by design (deactivation, not deletion, is the intended
    // lifecycle) — direct cleanup here keeps this file's own test data from
    // accumulating across repeated test:int runs. FK-dependency order: sessions ->
    // user_unit_access -> user_roles -> users (same order established earlier this
    // session for the RPT-14 fixture-leak cleanup). audit_logs rows referencing this
    // user are deliberately left in place — audit rows are permanent by design.
    if (!userId) return;
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.userUnitAccess.deleteMany({ where: { userId } });
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("Super Admin creates a UNIT_INCHARGE user and receives a one-time temporary password", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const res = await request(app.getHttpServer())
      .post("/admin/users")
      .set("Cookie", cookies)
      .send({ email, username, fullName: "Test In-Charge", role: "UNIT_INCHARGE" })
      .expect(201);

    expect(res.body.user.roles).toEqual(["UNIT_INCHARGE"]);
    expect(res.body.user.mustChangePassword).toBe(true);
    expect(typeof res.body.temporaryPassword).toBe("string");
    expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(12);

    userId = res.body.user.id as string;
    temporaryPassword = res.body.temporaryPassword as string;

    const auditRows = await prisma.auditLog.findMany({ where: { entityType: "users", entityId: userId, action: "USER_CREATE" } });
    expect(auditRows).toHaveLength(1);
  });

  it("the temporary password logs in, and the login response says mustChangePassword", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: temporaryPassword })
      .expect(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  it("change-password rejects a wrong current password", async () => {
    const cookies = await loginAs(email, temporaryPassword);
    await request(app.getHttpServer())
      .post("/auth/change-password")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFrom(cookies))
      .send({ currentPassword: "definitely-wrong", newPassword: "a-genuinely-long-new-password" })
      .expect(401);
  });

  it("change-password rejects a new password under 12 characters", async () => {
    const cookies = await loginAs(email, temporaryPassword);
    await request(app.getHttpServer())
      .post("/auth/change-password")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFrom(cookies))
      .send({ currentPassword: temporaryPassword, newPassword: "short" })
      .expect(400);
  });

  it("change-password with the correct current password clears mustChangePassword", async () => {
    const cookies = await loginAs(email, temporaryPassword);
    await request(app.getHttpServer())
      .post("/auth/change-password")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfTokenFrom(cookies))
      .send({ currentPassword: temporaryPassword, newPassword: "a-genuinely-long-new-password" })
      .expect(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.mustChangePassword).toBe(false);

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "a-genuinely-long-new-password" })
      .expect(200);
    expect(loginRes.body.user.mustChangePassword).toBe(false);
  });

  it("Finance Manager (admin.manage_unit_access) can reassign the user's role", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .patch(`/admin/users/${userId}/role`)
      .set("Cookie", cookies)
      .send({ role: "UNIT_USER" })
      .expect(200);
    expect(res.body.roles).toEqual(["UNIT_USER"]);

    const auditRows = await prisma.auditLog.findMany({ where: { entityType: "users", entityId: userId, action: "USER_ROLE_CHANGE" } });
    expect(auditRows).toHaveLength(1);
  });

  it("Finance Manager can grant and revoke unit access", async () => {
    const unit = await findAnyUnit();
    const cookies = await loginAs("financemanager@psh.local");

    const grantRes = await request(app.getHttpServer())
      .post(`/admin/users/${userId}/units`)
      .set("Cookie", cookies)
      .send({ unitId: unit.id })
      .expect(201);
    expect(grantRes.body.units.map((u: { id: string }) => u.id)).toContain(unit.id);

    const revokeRes = await request(app.getHttpServer())
      .delete(`/admin/users/${userId}/units/${unit.id}`)
      .set("Cookie", cookies)
      .expect(200);
    expect(revokeRes.body.units.map((u: { id: string }) => u.id)).not.toContain(unit.id);

    const auditActions = await prisma.auditLog.findMany({
      where: { entityType: "user_unit_access", entityId: userId },
      select: { action: true },
    });
    expect(auditActions.map((r) => r.action)).toEqual(
      expect.arrayContaining(["USER_UNIT_ACCESS_GRANT", "USER_UNIT_ACCESS_REVOKE"]),
    );
  });

  it("Finance Manager gets 403 deactivating the user (Super-Admin-only)", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .patch(`/admin/users/${userId}/status`)
      .set("Cookie", cookies)
      .send({ isActive: false })
      .expect(403);
  });

  it("Super Admin deactivates the user, and a reset issues a new working temporary password", async () => {
    const superAdminCookies = await loginAs("superadmin@psh.local");
    const deactivateRes = await request(app.getHttpServer())
      .patch(`/admin/users/${userId}/status`)
      .set("Cookie", superAdminCookies)
      .send({ isActive: false })
      .expect(200);
    expect(deactivateRes.body.isActive).toBe(false);

    // Reactivate before testing reset — a reset password on an inactive account isn't
    // useful to prove anything additional, and the login-check below needs isActive.
    await request(app.getHttpServer())
      .patch(`/admin/users/${userId}/status`)
      .set("Cookie", superAdminCookies)
      .send({ isActive: true })
      .expect(200);

    const resetRes = await request(app.getHttpServer())
      .post(`/admin/users/${userId}/reset-password`)
      .set("Cookie", superAdminCookies)
      .expect(201);
    const newTemporaryPassword = resetRes.body.temporaryPassword as string;

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: newTemporaryPassword })
      .expect(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
  });
});
