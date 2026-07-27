import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL. Exercises the full async export pipeline (Build Plan §3.7: POST /exports
// returns immediately, GET /exports/:id is polled to READY/FAILED, GET /exports/:id/
// download streams the generated file) through the real HTTP stack, plus the ownership
// check (Appendix A "Export reports": Own vs All) that has no other test coverage since
// it lives in a private service method.

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

async function pollUntilTerminal(cookies: string[], exportId: string, timeoutMs = 15_000): Promise<request.Response> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request(app.getHttpServer()).get(`/exports/${exportId}`).set("Cookie", cookies).expect(200);
    if (res.body.status === "READY" || res.body.status === "FAILED") {
      return res;
    }
    if (Date.now() > deadline) {
      throw new Error(`Export ${exportId} did not reach a terminal state within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
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

describe("POST /exports — validation", () => {
  it("requires authentication", async () => {
    await request(app.getHttpServer())
      .post("/exports")
      .send({ reportKey: "RPT-01", filters: {}, format: "CSV" })
      .expect(401);
  });

  // The "rejects a report key that has no export pipeline yet" case this test used to
  // cover (against RPT-09, then RPT-02 before that) no longer has a real target — every
  // ReportKeySchema value is now exportable as of Phase 7 (RPT-09/10 shipped once
  // monthly_closings existed, per ADR-0003). EXPORTABLE_REPORT_KEYS in
  // exports.service.ts stays as a defensive guard against a future report key landing
  // with a dataset but no export wiring, but there's no way to reach that 409 through
  // the API anymore to test it.

  it("rejects an invalid format", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post("/exports")
      .set("Cookie", cookies)
      .send({ reportKey: "RPT-01", filters: {}, format: "WORD" })
      .expect(400);
  });
});

describe("async export lifecycle (Build Plan §3.7)", () => {
  it("POST /exports returns PENDING immediately, then reaches READY with a downloadable file", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/exports")
      .set("Cookie", cookies)
      .send({ reportKey: "RPT-01", filters: { dateFrom: "2026-07-01", dateTo: "2026-07-31" }, format: "CSV" })
      .expect(201);

    expect(createRes.body.exportId).toBeDefined();
    expect(createRes.body.status).toBe("PENDING");
    expect(createRes.body.fileRef).toBeNull();

    const final = await pollUntilTerminal(cookies, createRes.body.exportId);
    expect(final.body.status).toBe("READY");
    expect(final.body.fileRef).toMatch(/^RPT-01_.*\.csv$/);
    expect(typeof final.body.rowCount).toBe("number");

    const downloadRes = await request(app.getHttpServer())
      .get(`/exports/${createRes.body.exportId}/download`)
      .set("Cookie", cookies)
      .expect(200);
    expect(downloadRes.headers["content-type"]).toContain("text/csv");
    expect(downloadRes.text).toContain("Report: RPT-01");

    const row = await prisma.reportExport.findUniqueOrThrow({ where: { id: createRes.body.exportId } });
    expect(row.downloadedAt).not.toBeNull();
  }, 20_000);

  it("generates a valid PDF export end to end", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/exports")
      .set("Cookie", cookies)
      .send({ reportKey: "RPT-04", filters: {}, format: "PDF" })
      .expect(201);

    const final = await pollUntilTerminal(cookies, createRes.body.exportId);
    expect(final.body.status).toBe("READY");

    const downloadRes = await request(app.getHttpServer())
      .get(`/exports/${createRes.body.exportId}/download`)
      .set("Cookie", cookies)
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(downloadRes.headers["content-type"]).toBe("application/pdf");
    expect((downloadRes.body as Buffer).subarray(0, 5).toString("ascii")).toBe("%PDF-");
  }, 20_000);

  it("generates a valid Excel export end to end", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/exports")
      .set("Cookie", cookies)
      .send({ reportKey: "RPT-06", filters: {}, format: "EXCEL" })
      .expect(201);

    const final = await pollUntilTerminal(cookies, createRes.body.exportId);
    expect(final.body.status).toBe("READY");

    const downloadRes = await request(app.getHttpServer())
      .get(`/exports/${createRes.body.exportId}/download`)
      .set("Cookie", cookies)
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(downloadRes.headers["content-type"]).toContain("spreadsheetml");
    // .xlsx files are zip archives — PK magic bytes confirm a real workbook was written.
    expect((downloadRes.body as Buffer).subarray(0, 2).toString("ascii")).toBe("PK");
  }, 20_000);

  it("downloading a nonexistent export returns 404", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .get("/exports/019f9e9e-0000-7000-8000-000000000000/download")
      .set("Cookie", cookies)
      .expect(404);
  });
});

describe("export ownership (Appendix A: Own for Center User/In-Charge, All for Finance/Auditor/Super Admin)", () => {
  it("a Center User can poll and download their own export", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/exports")
      .set("Cookie", cookies)
      .send({ reportKey: "RPT-01", filters: {}, format: "CSV" })
      .expect(201);

    const final = await pollUntilTerminal(cookies, createRes.body.exportId);
    expect(final.body.status).toBe("READY");
    await request(app.getHttpServer())
      .get(`/exports/${createRes.body.exportId}/download`)
      .set("Cookie", cookies)
      .expect(200);
  }, 20_000);

  it("a different Center User cannot poll or download someone else's export", async () => {
    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/exports")
      .set("Cookie", sohawaCookies)
      .send({ reportKey: "RPT-01", filters: {}, format: "CSV" })
      .expect(201);
    await pollUntilTerminal(sohawaCookies, createRes.body.exportId);

    const sukkurCookies = await loginAs("user.sukkur@psh.local");
    await request(app.getHttpServer())
      .get(`/exports/${createRes.body.exportId}`)
      .set("Cookie", sukkurCookies)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/exports/${createRes.body.exportId}/download`)
      .set("Cookie", sukkurCookies)
      .expect(403);
  }, 20_000);

  it("a Finance role (all-unit scope) can poll and download any user's export", async () => {
    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/exports")
      .set("Cookie", sohawaCookies)
      .send({ reportKey: "RPT-01", filters: {}, format: "CSV" })
      .expect(201);

    const financeCookies = await loginAs("financemanager@psh.local");
    await pollUntilTerminal(financeCookies, createRes.body.exportId);
    await request(app.getHttpServer())
      .get(`/exports/${createRes.body.exportId}/download`)
      .set("Cookie", financeCookies)
      .expect(200);
  }, 20_000);
});
