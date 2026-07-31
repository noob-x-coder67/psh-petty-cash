import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// FR-CLS-001..009. Uses PSH-BHW (not touched by the reports-reconciliation suites'
// wide-date-range read-only queries, and not the same account driven negative by the
// negative-balance-test fixture) so its ledger state stays predictable across runs.

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
  const res = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email, password: DEMO_PASSWORD })
    .expect(200);
  const cookies = extractCookies(res);
  sessions.set(email, cookies);
  return cookies;
}

// Computed in beforeAll, not randomized and not a fixed literal — see the comment there.
let TEST_YEAR: number;
const TEST_MONTH = 3;

// Must match CASH_COUNT_DENOMINATIONS in packages/contracts/src/schemas/month-close.ts.
const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10];

function zeroDenominations(): Array<{ denomination: number; count: number }> {
  return DENOMINATIONS.map((denomination) => ({ denomination, count: 0 }));
}

// Greedy decomposition into whole-rupee notes only (no coins in v1 — see the plan). This
// throws rather than silently misbehaving if a shared fixture account's live balance
// ever drifts to a value that isn't exactly representable this way (e.g. not a multiple
// of 10) — same "don't paper over drifted shared-fixture state" stance as this file's
// TEST_YEAR computation above.
function decomposeIntoDenominations(amountString: string): Array<{ denomination: number; count: number }> {
  let remaining = Math.round(Number(amountString));
  const rows = DENOMINATIONS.map((denomination) => {
    const count = Math.floor(remaining / denomination);
    remaining -= count * denomination;
    return { denomination, count };
  });
  if (remaining !== 0) {
    throw new Error(
      `Cannot exactly decompose ${amountString} into whole-rupee note denominations (remainder ${remaining}) — the shared fixture account's live balance drifted to a non-representable value.`,
    );
  }
  return rows;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
  prisma = app.get(PrismaService);

  // monthly_closings is a financial record with DELETE revoked from the app's own DB
  // role (psh_app) by design (migration 20260727101836, mirroring the ledger/audit-log
  // immutability rule) — so resetting this fixture by deleting it is not an option, and
  // picking "a random future year" was never actually safe: reused indefinitely against
  // a database with no teardown, a fixed or randomized year only *probably* avoids
  // colliding with a past run's leftover state, and that probability gets worse every
  // time this suite runs (verified against this exact failure: a past run's "reopen +
  // recount" step left PSH-BHW's row OPEN with a real physicalCashCount set, which a
  // later run's "before any cash count exists" test found instead of a truly untouched
  // period). Computing one past whatever this account has ever used is genuine,
  // permanent isolation instead: every run's fixture year is strictly greater than any
  // year this account's monthly_closings has ever contained, so it can never collide
  // with past state, without deleting anything.
  const [bwl, soh] = await Promise.all([
    prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } }),
    prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } }),
  ]);
  const [bwlAccount, sohAccount] = await Promise.all([
    prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: bwl.id } }),
    prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: soh.id } }),
  ]);
  const maxYear = await prisma.monthlyClosing.aggregate({
    where: { accountId: { in: [bwlAccount.id, sohAccount.id] } },
    _max: { periodYear: true },
  });
  TEST_YEAR = (maxYear._max.periodYear ?? 2199) + 1;
});

afterAll(async () => {
  await app.close();
});

describe("GET /monthly-close/:unitId/:year/:month — before any cash count exists", () => {
  it("returns a virtual OPEN row with a live expected balance", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.status).toBe("OPEN");
    expect(res.body.physicalCashCount).toBeNull();
    expect(typeof res.body.expectedBalance).toBe("string");
    expect(res.body.summary).toBeDefined();
  });

  it("requires authentication", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    await request(app.getHttpServer()).get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`).expect(401);
  });

  it("a unit-scoped user cannot view a different unit's closing", async () => {
    const otherUnit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .get(`/monthly-close/${otherUnit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", cookies)
      .expect(403);
  });
});

describe("POST /monthly-close — record cash count (FR-CLS-002/003/004)", () => {
  it("recording a count matching the expected balance needs no remarks", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const cookies = await loginAs("financeofficer@psh.local");

    const before = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", cookies)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({
        unitId: unit.id,
        periodYear: TEST_YEAR,
        periodMonth: TEST_MONTH,
        denominations: decomposeIntoDenominations(before.body.expectedBalance),
      })
      .expect(201);

    expect(res.body.variance).toBe("0.00");
    expect(res.body.status).toBe("OPEN");
    expect(res.body.countedByName).toBe("Finance Officer");
    expect(res.body.denominations).toHaveLength(DENOMINATIONS.length);
  });

  it("recording a mismatched count without remarks is rejected with 400", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      // PSH-CCS's balance is currently negative, so a large positive count is
      // guaranteed to mismatch — the exact figure doesn't matter for this test.
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: 4, denominations: [{ denomination: 5000, count: 200 }, ...zeroDenominations().filter((d) => d.denomination !== 5000)] })
      .expect(400);
  });

  it("recording the same mismatched count with remarks succeeds and records the variance", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("financeofficer@psh.local");
    const res = await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({
        unitId: unit.id,
        periodYear: TEST_YEAR,
        periodMonth: 4,
        denominations: [{ denomination: 5000, count: 200 }, ...zeroDenominations().filter((d) => d.denomination !== 5000)],
        remarks: "Physical count higher than expected — investigating",
      })
      .expect(201);
    expect(new Prisma.Decimal(res.body.variance).isZero()).toBe(false);
    expect(res.body.remarks).toContain("investigating");
    expect(res.body.physicalCashCount).toBe("1000000.00");
  });

  it("a Center User (has cash_count.enter) can record a count for their own unit", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    // This test proves the permission path, not an exact balance match — PSH-CCS is a
    // heavily shared fixture whose live balance isn't guaranteed to be representable in
    // whole-rupee notes under a full-suite run (confirmed: it drifted to a value with
    // cents during one such run), so an arbitrary count + unconditional remarks is used
    // instead of trying to echo the live expected balance back exactly.
    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({
        unitId: unit.id,
        periodYear: TEST_YEAR,
        periodMonth: 5,
        denominations: [{ denomination: 5000, count: 1 }, ...zeroDenominations().filter((d) => d.denomination !== 5000)],
        remarks: "Center User recording test — count not expected to match live balance",
      })
      .expect(201);
  });

  it("re-recording a count replaces the previous denomination breakdown rather than merging into it", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("financeofficer@psh.local");

    const first = await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({
        unitId: unit.id,
        periodYear: TEST_YEAR,
        periodMonth: 6,
        denominations: [{ denomination: 1000, count: 3 }, ...zeroDenominations().filter((d) => d.denomination !== 1000)],
        remarks: "first count",
      })
      .expect(201);
    expect(first.body.physicalCashCount).toBe("3000.00");
    expect(first.body.denominations.find((d: { denomination: number }) => d.denomination === 1000)?.count).toBe(3);

    const second = await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({
        unitId: unit.id,
        periodYear: TEST_YEAR,
        periodMonth: 6,
        denominations: [{ denomination: 500, count: 6 }, ...zeroDenominations().filter((d) => d.denomination !== 500)],
        remarks: "recount",
      })
      .expect(201);
    expect(second.body.physicalCashCount).toBe("3000.00");
    expect(second.body.denominations.find((d: { denomination: number }) => d.denomination === 1000)?.count).toBe(0);
    expect(second.body.denominations.find((d: { denomination: number }) => d.denomination === 500)?.count).toBe(6);
    expect(second.body.denominations).toHaveLength(DENOMINATIONS.length);
  });

  it("rejects a request missing one of the required denominations", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({
        unitId: unit.id,
        periodYear: TEST_YEAR,
        periodMonth: 7,
        denominations: zeroDenominations().filter((d) => d.denomination !== 10),
      })
      .expect(400);
  });

  it("a legacy closing recorded with no denomination breakdown still returns an empty array, not synthesized data", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    // Simulates a pre-feature record — inserted directly, bypassing the API, since no
    // such row can be produced through the API anymore (denominations are mandatory for
    // every new recording going forward).
    await prisma.monthlyClosing.create({
      data: {
        accountId: account.id,
        periodYear: TEST_YEAR,
        periodMonth: 8,
        physicalCashCount: new Prisma.Decimal("500.00"),
        expectedBalance: new Prisma.Decimal("500.00"),
        variance: new Prisma.Decimal("0.00"),
        countedBy: (await prisma.user.findFirstOrThrow({ where: { email: "financeofficer@psh.local" } })).id,
        countedAt: new Date(),
      },
    });

    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/8`)
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.physicalCashCount).toBe("500.00");
    expect(res.body.denominations).toEqual([]);
  });
});

describe("close/reopen lifecycle (FR-CLS-006/007)", () => {
  it("a Center User (lacks month.close) gets 403 trying to close", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close/close")
      .set("Cookie", sohawaCookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: TEST_MONTH })
      .expect(403);
  });

  it("Finance Manager closes the month, then it cannot be closed again", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const financeCookies = await loginAs("financemanager@psh.local");

    const closeRes = await request(app.getHttpServer())
      .post("/monthly-close/close")
      .set("Cookie", financeCookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: TEST_MONTH })
      .expect(201);
    expect(closeRes.body.status).toBe("CLOSED");
    expect(closeRes.body.closedByName).toBe("Finance Manager");

    await request(app.getHttpServer())
      .post("/monthly-close/close")
      .set("Cookie", financeCookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: TEST_MONTH })
      .expect(409);
  });

  it("cannot record a new cash count on a closed month without reopening first", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    // Finance Officer, not Finance Manager — ADR-0007 removed cash_count.enter from
    // Finance Manager/Super Admin entirely, so they'd 403 before ever reaching the
    // closed-period conflict this test is actually about.
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: TEST_MONTH, denominations: zeroDenominations(), remarks: "test" })
      .expect(409);
  });

  // ADR-0007: Finance Manager/Super Admin close administratively — no cash count
  // required, and closing works even when no MonthlyClosing row exists yet (the exact
  // scenario that prompted this ADR: "no cash count yet for the period I want to close,
  // and I have no way to enter one myself in this role").
  it("Finance Manager closes a period with no prior MonthlyClosing row at all", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const cookies = await loginAs("financemanager@psh.local");

    const before = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/9`)
      .set("Cookie", cookies)
      .expect(200);
    expect(before.body.id).toBe("");
    expect(before.body.status).toBe("OPEN");

    const closed = await request(app.getHttpServer())
      .post("/monthly-close/close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: 9 })
      .expect(201);
    expect(closed.body.status).toBe("CLOSED");
    expect(closed.body.physicalCashCount).toBeNull();
    expect(closed.body.denominations).toEqual([]);
    expect(closed.body.remarks).toBeNull();
    expect(typeof closed.body.expectedBalance).toBe("string");

    await request(app.getHttpServer())
      .post("/monthly-close/close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: 9 })
      .expect(409);
  });

  it("Finance Manager gets 403 recording a cash count — cash_count.enter no longer includes FM/SA", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: 10, denominations: zeroDenominations() })
      .expect(403);
  });

  it("Finance Officer still gets 403 trying to close — month.close stays Finance Manager/Super Admin only", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close/close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: 10 })
      .expect(403);
  });

  it("Auditor can view Month Close status (dashboard.view_own_unit) but cannot record or close", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const cookies = await loginAs("auditor@psh.local");
    const res = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/9`)
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.status).toBe("CLOSED");

    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: 10, denominations: zeroDenominations() })
      .expect(403);
    await request(app.getHttpServer())
      .post("/monthly-close/close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: 10 })
      .expect(403);
  });

  it("reopening without a reason is rejected", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const cookies = await loginAs("financemanager@psh.local");
    const row = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", cookies)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/monthly-close/${row.body.id}/reopen`)
      .set("Cookie", cookies)
      .send({ reason: "" })
      .expect(400);
  });

  it("Finance Manager reopens the month with a reason, and it's editable again", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const cookies = await loginAs("financemanager@psh.local");
    const row = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", cookies)
      .expect(200);

    const reopenRes = await request(app.getHttpServer())
      .post(`/monthly-close/${row.body.id}/reopen`)
      .set("Cookie", cookies)
      .send({ reason: "Correcting the physical count after a recount" })
      .expect(201);
    expect(reopenRes.body.status).toBe("OPEN");
    expect(reopenRes.body.reopenReason).toContain("recount");

    // Finance Officer, not Finance Manager — recording stays with the center/Finance
    // Officer exclusively per ADR-0007.
    const financeOfficerCookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", financeOfficerCookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: TEST_MONTH, denominations: decomposeIntoDenominations(row.body.expectedBalance) })
      .expect(201);
  });

  it("every close/reopen/cash-count action writes an audit_logs row", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BHW" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const closing = await prisma.monthlyClosing.findUniqueOrThrow({
      where: { accountId_periodYear_periodMonth: { accountId: account.id, periodYear: TEST_YEAR, periodMonth: TEST_MONTH } },
    });
    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: "monthly_closings", entityId: closing.id },
    });
    const actions = auditRows.map((row) => row.action);
    expect(actions).toContain("MONTH_CLOSE_CASH_COUNT");
    expect(actions).toContain("MONTH_CLOSE");
    expect(actions).toContain("MONTH_REOPEN");
  });
});
