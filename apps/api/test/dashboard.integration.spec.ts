import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL. Proves the DashboardModule's permission split (dashboard.view_all vs
// dashboard.view_own_unit) and that PSH-ISB structurally never appears (BR-016 — it has
// no petty-cash account, so it's absent from the accounts join, not filtered by code).

let app: INestApplication;
let prisma: PrismaService;
let buildingCategoryId = "";
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

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
  prisma = app.get(PrismaService);
  buildingCategoryId = (
    await prisma.expenseCategory.findUniqueOrThrow({
      where: { name: "Repair & Maintenance: Building" },
    })
  ).id;
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /dashboard/finance (dashboard.view_all)", () => {
  it("returns finance-wide KPIs and a unit grid that never includes PSH-ISB", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer()).get("/dashboard/finance").set("Cookie", cookies).expect(200);

    expect(res.body.kpis).toBeDefined();
    expect(typeof res.body.kpis.expectedCash).toBe("string");
    expect(Array.isArray(res.body.units)).toBe(true);
    expect(res.body.units.some((unit: { unitCode: string }) => unit.unitCode === "PSH-ISB")).toBe(false);
  });

  it("a Center User (no dashboard.view_all) gets 403", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer()).get("/dashboard/finance").set("Cookie", cookies).expect(403);
  });
});

describe("GET /dashboard/unit/:id (dashboard.view_own_unit)", () => {
  it("a unit-scoped user can view their own unit's dashboard", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    const res = await request(app.getHttpServer())
      .get(`/dashboard/unit/${unit.id}`)
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.unit.code).toBe("PSH-CCS");
    expect(typeof res.body.balance).toBe("string");
    expect(res.body.period.expectedCash).toBe(res.body.balance);
  });

  it("a unit-scoped user gets 403 for a unit outside their scope", async () => {
    const otherUnit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .get(`/dashboard/unit/${otherUnit.id}`)
      .set("Cookie", cookies)
      .expect(403);
  });

  it("a finance role (all-unit scope) can view any unit's dashboard", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const cookies = await loginAs("financeofficer@psh.local");
    const res = await request(app.getHttpServer())
      .get(`/dashboard/unit/${unit.id}`)
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.unit.code).toBe("PSH-SUK");
  });
});

// "Spent (this period)" (period.spent / kpis.spending) must net out reversed vouchers —
// a bug found in live testing: it used to sum every EXPENSE ledger entry regardless of
// whether the voucher behind it was later reversed, since a reversal posts a *separate*
// REVERSAL entry rather than altering the original. Uses PSH-SUK, not PSH-CCS (see
// docs/known-issues.md on PSH-CCS fixture reuse), and today's date so both the EXPENSE
// and REVERSAL entries land in the same accounting period, isolating the netting bug
// from the cross-period-boundary case (which is a different, correct behavior).
describe("GET /dashboard/unit/:id — spent (this period) nets out reversed vouchers", () => {
  it("a reversed voucher's amount drops back out of period.spent", async () => {
    // Keep the application clock in the same accounting period as this deliberately
    // fixed fixture date. Otherwise the assertion changes meaning at month rollover.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-30T12:00:00+05:00"));

    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const financeManagerCookies = await loginAs("financemanager@psh.local");

    const before = await request(app.getHttpServer())
      .get(`/dashboard/unit/${unit.id}`)
      .set("Cookie", financeManagerCookies)
      .expect(200);
    const baselineSpent = new Prisma.Decimal(before.body.period.spent);

    const sukkurCookies = await loginAs("user.sukkur@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", sukkurCookies)
      .send({
        unitId: unit.id,
        expenseDate: "2026-07-30",
        vendorName: "Net-Spend Test Vendor",
        justification: "dashboard.integration.spec.ts net-spend fixture",
        billTotal: "60.00",
        hasBill: true,
        lines: [{ description: "Supplies", categoryId: buildingCategoryId, amount: "60.00" }],
      })
      .expect(201);

    const afterExpense = await request(app.getHttpServer())
      .get(`/dashboard/unit/${unit.id}`)
      .set("Cookie", financeManagerCookies)
      .expect(200);
    expect(new Prisma.Decimal(afterExpense.body.period.spent).toFixed(2)).toBe(baselineSpent.plus("60.00").toFixed(2));

    await request(app.getHttpServer())
      .post(`/expenses/${createRes.body.voucher.id}/reverse`)
      .set("Cookie", financeManagerCookies)
      .send({ reason: "dashboard.integration.spec.ts net-spend fixture — reversing" })
      .expect(201);

    const afterReversal = await request(app.getHttpServer())
      .get(`/dashboard/unit/${unit.id}`)
      .set("Cookie", financeManagerCookies)
      .expect(200);
    expect(new Prisma.Decimal(afterReversal.body.period.spent).toFixed(2)).toBe(baselineSpent.toFixed(2));
  });
});
