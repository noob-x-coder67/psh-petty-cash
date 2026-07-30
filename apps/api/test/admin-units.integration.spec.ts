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
// DATABASE_URL. Units are Super-Admin-only end to end (admin.manage_users_units) — SRS
// §6.1 lists "units" only under Super Admin's responsibilities, unlike users/access
// (admin.manage_unit_access), which Finance Manager shares.

let app: INestApplication;
let prisma: PrismaService;
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
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

describe("GET /admin/units — permission gate", () => {
  it("Finance Officer gets 403", async () => {
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer()).get("/admin/units").set("Cookie", cookies).expect(403);
  });

  it("Finance Manager gets 403 — units aren't part of the Limited grant", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer()).get("/admin/units").set("Cookie", cookies).expect(403);
  });

  it("Super Admin gets 200 and sees inactive units too (unlike GET /units)", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const res = await request(app.getHttpServer()).get("/admin/units").set("Cookie", cookies).expect(200);
    expect(res.body.some((unit: { code: string }) => unit.code === "PSH-ISB")).toBe(true);
  });
});

describe("PSH-ISB structural exclusion (BR-016, R-11) — service-layer guard, not the raw DB constraint", () => {
  it("rejects creating a new unit with code PSH-ISB and pettyCashEnabled true with a 400, not a 500", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const marker = randomUUID().slice(0, 8);
    const res = await request(app.getHttpServer())
      .post("/admin/units")
      .set("Cookie", cookies)
      .send({ code: `PSH-ISB`, name: `Probe ${marker}`, type: "CENTER", pettyCashEnabled: true })
      .expect(400);
    expect(res.body.message).toMatch(/PSH-ISB/i);
  });

  it("rejects PATCHing the real PSH-ISB unit's pettyCashEnabled to true with a 400", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const pshIsb = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-ISB" } });
    const res = await request(app.getHttpServer())
      .patch(`/admin/units/${pshIsb.id}`)
      .set("Cookie", cookies)
      .send({ pettyCashEnabled: true })
      .expect(400);
    expect(res.body.message).toMatch(/PSH-ISB/i);

    const stillDisabled = await prisma.organizationalUnit.findUniqueOrThrow({ where: { id: pshIsb.id } });
    expect(stillDisabled.pettyCashEnabled).toBe(false);
  });

  it("a partial update to PSH-ISB that doesn't touch pettyCashEnabled succeeds normally", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const pshIsb = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-ISB" } });
    const res = await request(app.getHttpServer())
      .patch(`/admin/units/${pshIsb.id}`)
      .set("Cookie", cookies)
      .send({ city: pshIsb.city })
      .expect(200);
    expect(res.body.pettyCashEnabled).toBe(false);
  });
});

describe("full lifecycle: create -> duplicate code rejected -> update -> deactivate/reactivate", () => {
  const marker = randomUUID().slice(0, 8);
  const code = `TEST-${marker}`;
  let unitId: string;

  afterAll(async () => {
    // No DELETE endpoint by design (same reasoning as users — deactivation is the
    // intended lifecycle) — direct cleanup so this file's fixture doesn't accumulate
    // across repeated test:int runs.
    if (!unitId) return;
    await prisma.organizationalUnit.delete({ where: { id: unitId } });
  });

  it("Super Admin creates a unit and an audit row is written", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const res = await request(app.getHttpServer())
      .post("/admin/units")
      .set("Cookie", cookies)
      .send({ code, name: "Test Unit", type: "CENTER", city: "Test City", pettyCashEnabled: false })
      .expect(201);
    expect(res.body.code).toBe(code);
    expect(res.body.pettyCashEnabled).toBe(false);
    unitId = res.body.id as string;

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: "organizational_units", entityId: unitId, action: "UNIT_CREATE" },
    });
    expect(auditRows).toHaveLength(1);
  });

  it("creating a second unit with the same code is rejected with 409", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    await request(app.getHttpServer())
      .post("/admin/units")
      .set("Cookie", cookies)
      .send({ code, name: "Duplicate Attempt", type: "CENTER", pettyCashEnabled: false })
      .expect(409);
  });

  it("Super Admin updates the unit's name and enables petty cash", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const res = await request(app.getHttpServer())
      .patch(`/admin/units/${unitId}`)
      .set("Cookie", cookies)
      .send({ name: "Test Unit Renamed", pettyCashEnabled: true })
      .expect(200);
    expect(res.body.name).toBe("Test Unit Renamed");
    expect(res.body.pettyCashEnabled).toBe(true);

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: "organizational_units", entityId: unitId, action: "UNIT_UPDATE" },
    });
    expect(auditRows).toHaveLength(1);
  });

  it("Super Admin deactivates and reactivates the unit", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const deactivated = await request(app.getHttpServer())
      .patch(`/admin/units/${unitId}`)
      .set("Cookie", cookies)
      .send({ isActive: false })
      .expect(200);
    expect(deactivated.body.isActive).toBe(false);

    const reactivated = await request(app.getHttpServer())
      .patch(`/admin/units/${unitId}`)
      .set("Cookie", cookies)
      .send({ isActive: true })
      .expect(200);
    expect(reactivated.body.isActive).toBe(true);
  });

  it("Finance Manager gets 403 attempting to update the unit", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .patch(`/admin/units/${unitId}`)
      .set("Cookie", cookies)
      .send({ name: "Should not apply" })
      .expect(403);
  });
});
