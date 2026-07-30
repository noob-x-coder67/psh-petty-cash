import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";

// Read-only (GET /admin/settings) — no mutations, no audit-row assertions, same
// reasoning as admin-roles.integration.spec.ts.

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

describe("GET /admin/settings — permission gate (admin.manage_users_units, Super Admin only)", () => {
  it("Finance Officer gets 403", async () => {
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer()).get("/admin/settings").set("Cookie", cookies).expect(403);
  });

  it("Finance Manager gets 403 — settings aren't part of the Limited grant", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer()).get("/admin/settings").set("Cookie", cookies).expect(403);
  });

  it("Super Admin gets 200 with the expected setting keys, each marked enforced or not", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const res = await request(app.getHttpServer()).get("/admin/settings").set("Cookie", cookies).expect(200);

    const byKey = new Map(res.body.settings.map((setting: { key: string; enforced: boolean }) => [setting.key, setting]));
    expect(byKey.has("ATTACHMENT_STORAGE_DRIVER")).toBe(true);
    expect(byKey.has("UPLOAD_MAX_BYTES")).toBe(true);
    expect(byKey.has("THROTTLE_DEFAULT")).toBe(true);

    // BR-014/BR-015's archival job doesn't exist yet — these two must never be reported
    // as `enforced: true`, which would mislead an admin into thinking retention/deletion
    // is actually happening.
    expect((byKey.get("UPLOAD_RETENTION_DAYS") as { enforced: boolean }).enforced).toBe(false);
    expect((byKey.get("ARCHIVE_GRACE_DAYS") as { enforced: boolean }).enforced).toBe(false);
  });
});
