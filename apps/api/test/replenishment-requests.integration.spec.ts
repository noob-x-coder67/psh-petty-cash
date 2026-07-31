import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { currentKarachiPeriod } from "../src/modules/dashboard/period.util";
import { precedingThreeMonths } from "../src/modules/month-close/replenishments.rules";

// ADR-0010: Replenishment Request -> Approve -> Confirm. BR-013 is now evaluated
// against the real current Asia/Karachi month at submission/override time (not a
// client-supplied issueDate, since a request has none yet) — the same anchor
// GET /compliance/:unitId already uses. That makes the old synthetic-future-year
// isolation trick (see replenishments.integration.spec.ts's former BASE_YEAR) unusable
// here: this file instead uses two dedicated units untouched by any other integration
// file's compliance fixtures — FTZ-DST-MCR, whose real preceding 3 months are
// idempotently force-closed once in beforeAll (making it always compliant), and
// FTZ-DST-DHQ, left alone (guaranteed held, since nothing else in this suite writes
// real-dated monthly_closings rows for any unit).

let app: INestApplication;
let prisma: PrismaService;
const sessions = new Map<string, string[]>();

let compliantUnitId: string;
let heldUnitId: string;
let heldAccountId: string;

function extractCookies(res: request.Response): string[] {
  const raw = res.headers["set-cookie"] as unknown;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return [raw];
  return [];
}

async function loginAs(email: string): Promise<string[]> {
  const cached = sessions.get(email);
  if (cached) return cached;
  const res = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email, password: DEMO_PASSWORD })
    .expect(200);
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

  const compliantUnit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "FTZ-DST-MCR" } });
  const compliantAccount = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: compliantUnit.id } });
  compliantUnitId = compliantUnit.id;

  const heldUnit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "FTZ-DST-DHQ" } });
  const heldAccount = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: heldUnit.id } });
  heldUnitId = heldUnit.id;
  heldAccountId = heldAccount.id;

  const anchor = currentKarachiPeriod().start;
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + 1;
  for (const period of precedingThreeMonths(year, month)) {
    await prisma.monthlyClosing.upsert({
      where: {
        accountId_periodYear_periodMonth: {
          accountId: compliantAccount.id,
          periodYear: period.year,
          periodMonth: period.month,
        },
      },
      create: { accountId: compliantAccount.id, periodYear: period.year, periodMonth: period.month, status: "CLOSED" },
      update: { status: "CLOSED" },
    });
  }
});

afterAll(async () => {
  await app.close();
});

describe("POST /replenishment-requests — submit (BR-013 enforced here, hard block)", () => {
  it("is blocked with 409 for a held unit, and no row is persisted at all", async () => {
    // Delta-based, not an absolute count — psh_petty_cash_test never resets between
    // `pnpm test:int` runs within a session (docs/known-issues.md), so an exact "zero
    // rows" assertion would only pass on the very first run.
    const countBefore = await prisma.replenishmentRequest.count({ where: { accountId: heldAccountId } });

    const cookies = await loginAs("user.ftzdhq@psh.local");
    await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", cookies)
      .send({ unitId: heldUnitId, amount: "1000.00", reason: "hold test", idempotencyKey: randomUUID() })
      .expect(409);

    const countAfter = await prisma.replenishmentRequest.count({ where: { accountId: heldAccountId } });
    expect(countAfter).toBe(countBefore);
  });

  it("succeeds for a compliant unit, status PENDING", async () => {
    const cookies = await loginAs("user.ftzmcr@psh.local");
    const res = await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", cookies)
      .send({ unitId: compliantUnitId, amount: "500.00", reason: "routine top-up", idempotencyKey: randomUUID() })
      .expect(201);

    expect(res.body.status).toBe("PENDING");
    expect(res.body.isCompliant).toBe(true);
    expect(res.body.replenishmentId).toBeNull();
    expect(res.body.unitCode).toBe("FTZ-DST-MCR");
  });

  it("idempotencyKey replay returns the original request instead of creating a duplicate", async () => {
    const cookies = await loginAs("user.ftzmcr@psh.local");
    const key = randomUUID();
    const payload = { unitId: compliantUnitId, amount: "50.00", reason: "idempotency test", idempotencyKey: key };

    const first = await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", cookies)
      .send(payload)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", cookies)
      .send(payload)
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
  });

  it("Finance Manager gets 403 — submitting is exclusively the unit's own job", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", cookies)
      .send({ unitId: compliantUnitId, amount: "100.00", reason: "should be rejected", idempotencyKey: randomUUID() })
      .expect(403);
  });

  it("Finance Officer gets 403 — replenishment.request was never granted to that role (ADR-0010)", async () => {
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", cookies)
      .send({ unitId: compliantUnitId, amount: "100.00", reason: "should be rejected", idempotencyKey: randomUUID() })
      .expect(403);
  });

  it("a user from a different unit gets 403", async () => {
    const cookies = await loginAs("user.ftzdhq@psh.local");
    await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", cookies)
      .send({ unitId: compliantUnitId, amount: "100.00", reason: "wrong unit", idempotencyKey: randomUUID() })
      .expect(403);
  });
});

describe("POST /replenishment-requests/override — Finance-initiated audited exception (ADR-0010/BR-013)", () => {
  it("a compliant unit gets 400 — override is only for a genuinely held unit", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post("/replenishment-requests/override")
      .set("Cookie", cookies)
      .send({
        unitId: compliantUnitId,
        amount: "100.00",
        reason: "should be rejected",
        exceptionReason: "trying anyway",
        issueDate: "2026-06-01",
        idempotencyKey: randomUUID(),
      })
      .expect(400);
  });

  it("a held unit succeeds, creating an APPROVED request and its replenishment atomically", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .post("/replenishment-requests/override")
      .set("Cookie", cookies)
      .send({
        unitId: heldUnitId,
        amount: "750.00",
        reason: "urgent relocation top-up",
        exceptionReason: "Unit relocated mid-quarter; closings will be backfilled",
        issueDate: "2026-06-05",
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    expect(res.body.status).toBe("APPROVED");
    expect(res.body.isCompliant).toBe(false);
    expect(res.body.exceptionReason).toContain("relocated");
    expect(res.body.replenishmentId).toBeTruthy();
    expect(res.body.decidedByName).toBe("Finance Manager");

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: "replenishment_requests", action: "REPLENISHMENT_REQUEST_OVERRIDE", entityId: res.body.id },
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.reason).toContain("relocated");

    // The unit can confirm receipt through the unchanged, locked confirm flow (ADR-0009).
    const unitCookies = await loginAs("user.ftzdhq@psh.local");
    const confirmed = await request(app.getHttpServer())
      .post(`/replenishments/${res.body.replenishmentId}/confirm`)
      .set("Cookie", unitCookies)
      .send({ confirmedDate: "2026-06-06" })
      .expect(201);
    expect(confirmed.body.confirmedAmount).toBe("750.00");
  });

  it("rejects a duplicate reference number on the same account with a friendly 409", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const reference = `OVERRIDE-DUP-${randomUUID()}`;
    const body = (amount: string) => ({
      unitId: heldUnitId,
      amount,
      reason: "duplicate reference test",
      exceptionReason: "duplicate reference test",
      issueDate: "2026-06-10",
      referenceNo: reference,
      idempotencyKey: randomUUID(),
    });

    await request(app.getHttpServer())
      .post("/replenishment-requests/override")
      .set("Cookie", cookies)
      .send(body("111.00"))
      .expect(201);
    await request(app.getHttpServer())
      .post("/replenishment-requests/override")
      .set("Cookie", cookies)
      .send(body("222.00"))
      .expect(409);
  });

  it("an empty exception reason gets 400", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post("/replenishment-requests/override")
      .set("Cookie", cookies)
      .send({
        unitId: heldUnitId,
        amount: "100.00",
        reason: "missing exception reason",
        exceptionReason: "",
        issueDate: "2026-06-01",
        idempotencyKey: randomUUID(),
      })
      .expect(400);
  });

  it("a unit user (no compliance.override_three_month_hold) gets 403", async () => {
    const cookies = await loginAs("user.ftzdhq@psh.local");
    await request(app.getHttpServer())
      .post("/replenishment-requests/override")
      .set("Cookie", cookies)
      .send({
        unitId: heldUnitId,
        amount: "100.00",
        reason: "should be rejected",
        exceptionReason: "trying anyway",
        issueDate: "2026-06-01",
        idempotencyKey: randomUUID(),
      })
      .expect(403);
  });
});

describe("GET /replenishment-requests/pending — Finance approval queue (cross-unit)", () => {
  it("Finance Manager sees a pending request submitted by a unit", async () => {
    const unitCookies = await loginAs("user.ftzmcr@psh.local");
    const submitRes = await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", unitCookies)
      .send({ unitId: compliantUnitId, amount: "321.00", reason: "visible in queue test", idempotencyKey: randomUUID() })
      .expect(201);

    const financeCookies = await loginAs("financemanager@psh.local");
    const pendingRes = await request(app.getHttpServer())
      .get("/replenishment-requests/pending")
      .set("Cookie", financeCookies)
      .expect(200);

    expect(pendingRes.body.some((row: { id: string }) => row.id === submitRes.body.id)).toBe(true);
  });

  it("a unit user (no replenishment.approve) gets 403", async () => {
    const cookies = await loginAs("user.ftzmcr@psh.local");
    await request(app.getHttpServer()).get("/replenishment-requests/pending").set("Cookie", cookies).expect(403);
  });
});

describe("POST /replenishment-requests/:id/approve and /reject", () => {
  it("approve creates the Replenishment, locks the amount, and the unit can confirm it", async () => {
    const unitCookies = await loginAs("user.ftzmcr@psh.local");
    const submitRes = await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", unitCookies)
      .send({ unitId: compliantUnitId, amount: "999.00", reason: "approve-flow test", idempotencyKey: randomUUID() })
      .expect(201);

    const financeCookies = await loginAs("financemanager@psh.local");
    const approveRes = await request(app.getHttpServer())
      .post(`/replenishment-requests/${submitRes.body.id}/approve`)
      .set("Cookie", financeCookies)
      .send({ issueDate: "2026-06-15", referenceNo: `APPROVE-${randomUUID()}` })
      .expect(201);

    expect(approveRes.body.status).toBe("APPROVED");
    expect(approveRes.body.replenishmentId).toBeTruthy();

    const replenishment = await prisma.replenishment.findUniqueOrThrow({ where: { id: approveRes.body.replenishmentId } });
    expect(replenishment.amount.toFixed(2)).toBe("999.00"); // locked to the requested amount, not editable at approval
    expect(replenishment.requestId).toBe(submitRes.body.id);

    const confirmed = await request(app.getHttpServer())
      .post(`/replenishments/${approveRes.body.replenishmentId}/confirm`)
      .set("Cookie", unitCookies)
      .send({ confirmedDate: "2026-06-16" })
      .expect(201);
    expect(confirmed.body.confirmedAmount).toBe("999.00");
  });

  it("approving an already-decided request gets 409", async () => {
    const unitCookies = await loginAs("user.ftzmcr@psh.local");
    const submitRes = await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", unitCookies)
      .send({ unitId: compliantUnitId, amount: "10.00", reason: "double-decide test", idempotencyKey: randomUUID() })
      .expect(201);

    const financeCookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post(`/replenishment-requests/${submitRes.body.id}/approve`)
      .set("Cookie", financeCookies)
      .send({ issueDate: "2026-06-17" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/replenishment-requests/${submitRes.body.id}/approve`)
      .set("Cookie", financeCookies)
      .send({ issueDate: "2026-06-18" })
      .expect(409);
  });

  it("reject records the reason and the unit sees REJECTED in its own history", async () => {
    const unitCookies = await loginAs("user.ftzmcr@psh.local");
    const submitRes = await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", unitCookies)
      .send({ unitId: compliantUnitId, amount: "20.00", reason: "reject-flow test", idempotencyKey: randomUUID() })
      .expect(201);

    const financeCookies = await loginAs("financemanager@psh.local");
    const rejectRes = await request(app.getHttpServer())
      .post(`/replenishment-requests/${submitRes.body.id}/reject`)
      .set("Cookie", financeCookies)
      .send({ rejectionReason: "Amount doesn't match current need" })
      .expect(201);

    expect(rejectRes.body.status).toBe("REJECTED");
    expect(rejectRes.body.rejectionReason).toContain("doesn't match");
    expect(rejectRes.body.replenishmentId).toBeNull();

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: "replenishment_requests", action: "REPLENISHMENT_REQUEST_REJECT", entityId: submitRes.body.id },
    });
    expect(auditRows).toHaveLength(1);

    const historyRes = await request(app.getHttpServer())
      .get(`/replenishment-requests/unit/${compliantUnitId}`)
      .set("Cookie", unitCookies)
      .expect(200);
    const found = historyRes.body.find((row: { id: string }) => row.id === submitRes.body.id);
    expect(found?.status).toBe("REJECTED");
  });

  it("an empty rejection reason gets 400", async () => {
    const unitCookies = await loginAs("user.ftzmcr@psh.local");
    const submitRes = await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", unitCookies)
      .send({ unitId: compliantUnitId, amount: "30.00", reason: "empty-reason test", idempotencyKey: randomUUID() })
      .expect(201);

    const financeCookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post(`/replenishment-requests/${submitRes.body.id}/reject`)
      .set("Cookie", financeCookies)
      .send({ rejectionReason: "" })
      .expect(400);
  });

  it("a unit user (no replenishment.approve) gets 403 approving", async () => {
    const unitCookies = await loginAs("user.ftzmcr@psh.local");
    const submitRes = await request(app.getHttpServer())
      .post("/replenishment-requests")
      .set("Cookie", unitCookies)
      .send({ unitId: compliantUnitId, amount: "40.00", reason: "permission test", idempotencyKey: randomUUID() })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/replenishment-requests/${submitRes.body.id}/approve`)
      .set("Cookie", unitCookies)
      .send({ issueDate: "2026-06-19" })
      .expect(403);
  });

  it("approving a non-existent request gets 404", async () => {
    const financeCookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post(`/replenishment-requests/${randomUUID()}/approve`)
      .set("Cookie", financeCookies)
      .send({ issueDate: "2026-06-20" })
      .expect(404);
  });
});
