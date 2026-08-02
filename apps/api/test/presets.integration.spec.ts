import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// SRS §12.8 "saved presets per Finance user". The first test in this file exists
// specifically to guard against a routing-order bug: PresetsController's literal
// "reports/presets" path must be registered before ReportsController's GET
// /reports/:reportKey, or Express matches the param route first and ZodValidationPipe
// rejects "presets" as an invalid ReportKey.

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

describe("GET /reports/presets does not collide with GET /reports/:reportKey", () => {
  it("returns a plain array (never a ReportKey validation error)", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer()).get("/reports/presets").set("Cookie", cookies).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("preset CRUD", () => {
  it("persists and reloads a managed category ID without a legacy category field", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const category = await prisma.expenseCategory.findUniqueOrThrow({ where: { name: "Food" } });
    const presetName = `Managed category preset ${Date.now()}`;

    const createRes = await request(app.getHttpServer())
      .post("/reports/presets")
      .set("Cookie", cookies)
      .send({ reportKey: "RPT-03", name: presetName, filters: { categoryId: category.id } })
      .expect(201);

    expect(createRes.body.filters).toEqual({ categoryId: category.id });
    const stored = await prisma.reportPreset.findUniqueOrThrow({ where: { id: createRes.body.id } });
    expect(stored.filters).toEqual({ categoryId: category.id });
    expect(stored.filters).not.toHaveProperty("category");

    const listRes = await request(app.getHttpServer())
      .get("/reports/presets")
      .query({ reportKey: "RPT-03" })
      .set("Cookie", cookies)
      .expect(200);
    expect(
      listRes.body.find((preset: { id: string }) => preset.id === createRes.body.id)?.filters,
    ).toEqual({ categoryId: category.id });

    await request(app.getHttpServer())
      .delete(`/reports/presets/${createRes.body.id}`)
      .set("Cookie", cookies)
      .expect(204);
  });

  it("creates, lists, and deletes a preset", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const presetName = `Test preset ${Date.now()}`;

    const createRes = await request(app.getHttpServer())
      .post("/reports/presets")
      .set("Cookie", cookies)
      .send({ reportKey: "RPT-01", name: presetName, filters: { unitIds: [] } })
      .expect(201);
    expect(createRes.body.name).toBe(presetName);
    expect(createRes.body.reportKey).toBe("RPT-01");

    const listRes = await request(app.getHttpServer())
      .get("/reports/presets")
      .query({ reportKey: "RPT-01" })
      .set("Cookie", cookies)
      .expect(200);
    expect(listRes.body.some((preset: { id: string }) => preset.id === createRes.body.id)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/reports/presets/${createRes.body.id}`)
      .set("Cookie", cookies)
      .expect(204);

    const afterDeleteRes = await request(app.getHttpServer())
      .get("/reports/presets")
      .query({ reportKey: "RPT-01" })
      .set("Cookie", cookies)
      .expect(200);
    expect(afterDeleteRes.body.some((preset: { id: string }) => preset.id === createRes.body.id)).toBe(false);
  });

  it("rejects a duplicate name for the same user and report with 409", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const presetName = `Duplicate test ${Date.now()}`;
    const createRes = await request(app.getHttpServer())
      .post("/reports/presets")
      .set("Cookie", cookies)
      .send({ reportKey: "RPT-04", name: presetName, filters: {} })
      .expect(201);

    await request(app.getHttpServer())
      .post("/reports/presets")
      .set("Cookie", cookies)
      .send({ reportKey: "RPT-04", name: presetName, filters: {} })
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/reports/presets/${createRes.body.id}`)
      .set("Cookie", cookies)
      .expect(204);
  });

  it("a different user cannot delete someone else's preset", async () => {
    const financeCookies = await loginAs("financemanager@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/reports/presets")
      .set("Cookie", financeCookies)
      .send({ reportKey: "RPT-06", name: `Ownership test ${Date.now()}`, filters: {} })
      .expect(201);

    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .delete(`/reports/presets/${createRes.body.id}`)
      .set("Cookie", sohawaCookies)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/reports/presets/${createRes.body.id}`)
      .set("Cookie", financeCookies)
      .expect(204);
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/reports/presets").expect(401);
  });
});
