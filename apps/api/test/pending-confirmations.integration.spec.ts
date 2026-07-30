import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// GET /allocations/pending/:unitId and GET /replenishments/pending/:unitId — the fix
// for the gap found while reviewing Cash Flow permissions: allocation.confirm_receipt
// is already granted to Center User/In-Charge (Appendix A), but with no list endpoint
// they had no way to discover something Finance created in a different session. Uses
// PSH-SUK (not PSH-SOH, which several other integration files reuse heavily — see
// docs/known-issues.md) to keep this file's fixtures independent.

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

function csrfTokenFrom(cookies: string[]): string {
  const raw = cookies.find((cookie) => cookie.startsWith("psh_csrf_token="));
  const value = raw?.split(";")[0]?.split("=")[1];
  if (!value) throw new Error("psh_csrf_token cookie not found");
  return decodeURIComponent(value);
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

describe("GET /allocations/pending/:unitId", () => {
  it("Finance Officer gets 403 — allocation.record doesn't include allocation.confirm_receipt", async () => {
    const cookies = await loginAs("financeofficer@psh.local");
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    await request(app.getHttpServer()).get(`/allocations/pending/${unit.id}`).set("Cookie", cookies).expect(403);
  });

  it("a Center User outside the target unit's scope gets 403", async () => {
    const cookies = await loginAs("user.sohawa@psh.local"); // PSH-SOH, not PSH-SUK
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    await request(app.getHttpServer()).get(`/allocations/pending/${unit.id}`).set("Cookie", cookies).expect(403);
  });

  it("lists an unconfirmed allocation for the unit's own Center User, and it drops off the list once confirmed", async () => {
    const financeCookies = await loginAs("financeofficer@psh.local");
    const financeCsrf = csrfTokenFrom(financeCookies);
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const marker = randomUUID().slice(0, 8);

    const created = await request(app.getHttpServer())
      .post("/allocations")
      .set("Cookie", financeCookies)
      .set("X-CSRF-Token", financeCsrf)
      .send({ unitId: unit.id, amount: "555.00", issueDate: "2026-07-30", referenceNo: `PENDING-${marker}`, idempotencyKey: randomUUID() })
      .expect(201);

    // A separate session — the whole point of this endpoint: the unit's own Center
    // User, who never saw the create request, discovers it here.
    const unitCookies = await loginAs("user.sukkur@psh.local");
    const beforeConfirm = await request(app.getHttpServer())
      .get(`/allocations/pending/${unit.id}`)
      .set("Cookie", unitCookies)
      .expect(200);
    expect(beforeConfirm.body.some((a: { id: string }) => a.id === created.body.id)).toBe(true);

    const unitCsrf = csrfTokenFrom(unitCookies);
    await request(app.getHttpServer())
      .post(`/allocations/${created.body.id}/confirm`)
      .set("Cookie", unitCookies)
      .set("X-CSRF-Token", unitCsrf)
      .send({ confirmedAmount: "555.00", confirmedDate: "2026-07-30" })
      .expect(201);

    const afterConfirm = await request(app.getHttpServer())
      .get(`/allocations/pending/${unit.id}`)
      .set("Cookie", unitCookies)
      .expect(200);
    expect(afterConfirm.body.some((a: { id: string }) => a.id === created.body.id)).toBe(false);
  });
});

describe("GET /replenishments/pending/:unitId", () => {
  it("Finance Officer gets 403", async () => {
    const cookies = await loginAs("financeofficer@psh.local");
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    await request(app.getHttpServer()).get(`/replenishments/pending/${unit.id}`).set("Cookie", cookies).expect(403);
  });

  it("a Center User outside the target unit's scope gets 403", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    await request(app.getHttpServer()).get(`/replenishments/pending/${unit.id}`).set("Cookie", cookies).expect(403);
  });

  it("lists an unconfirmed replenishment for the unit's own Center User, and it drops off once confirmed", async () => {
    // financemanager (compliance.override_three_month_hold) with an exception reason —
    // sidesteps BR-013's three-month hold, which is irrelevant to what this test
    // actually checks (list visibility + confirm-clears-it), same shortcut the live
    // verification for this feature used.
    const financeCookies = await loginAs("financemanager@psh.local");
    const financeCsrf = csrfTokenFrom(financeCookies);
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const marker = randomUUID().slice(0, 8);

    const created = await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeCookies)
      .set("X-CSRF-Token", financeCsrf)
      .send({
        unitId: unit.id,
        amount: "222.00",
        issueDate: "2026-07-30",
        referenceNo: `PENDING-REPL-${marker}`,
        idempotencyKey: randomUUID(),
        exceptionReason: "pending-confirmations.integration.spec.ts fixture",
      })
      .expect(201);

    const unitCookies = await loginAs("user.sukkur@psh.local");
    const beforeConfirm = await request(app.getHttpServer())
      .get(`/replenishments/pending/${unit.id}`)
      .set("Cookie", unitCookies)
      .expect(200);
    expect(beforeConfirm.body.some((r: { id: string }) => r.id === created.body.id)).toBe(true);

    const unitCsrf = csrfTokenFrom(unitCookies);
    await request(app.getHttpServer())
      .post(`/replenishments/${created.body.id}/confirm`)
      .set("Cookie", unitCookies)
      .set("X-CSRF-Token", unitCsrf)
      .send({ confirmedAmount: "222.00", confirmedDate: "2026-07-30" })
      .expect(201);

    const afterConfirm = await request(app.getHttpServer())
      .get(`/replenishments/pending/${unit.id}`)
      .set("Cookie", unitCookies)
      .expect(200);
    expect(afterConfirm.body.some((r: { id: string }) => r.id === created.body.id)).toBe(false);
  });
});
