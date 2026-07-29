import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL. Proves the DashboardModule's permission split (dashboard.view_all vs
// dashboard.view_own_unit) and that PSH-ISB structurally never appears (BR-016 — it has
// no petty-cash account, so it's absent from the accounts join, not filtered by code).

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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    const res = await request(app.getHttpServer())
      .get(`/dashboard/unit/${unit.id}`)
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.unit.code).toBe("PSH-SOH");
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
