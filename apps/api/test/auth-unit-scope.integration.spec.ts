import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL — this suite logs in as the real seeded demo users and exercises the
// full HTTP stack (guards, cookies, CSRF) rather than mocking any of it.
//
// Each demo user is logged in exactly once (see `sessions` below) rather than per test —
// partly for speed, but mainly because /auth/login is intentionally rate-limited per IP
// regardless of which account is being tried (Build Plan §6.1's email-spray defense),
// and a real client wouldn't re-authenticate before every request either.

let app: INestApplication;
const sessions = new Map<string, string[]>();

function extractCookies(res: request.Response): string[] {
  const raw = res.headers["set-cookie"] as unknown;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return [raw];
  return [];
}

function cookieValue(cookies: string[], name: string): string {
  const match = cookies.map((c) => c.split(";")[0]).find((c) => c?.startsWith(`${name}=`));
  if (!match) throw new Error(`cookie ${name} not found in ${JSON.stringify(cookies)}`);
  return match.split("=")[1] ?? "";
}

const DEMO_EMAILS = [
  "superadmin@psh.local",
  "financemanager@psh.local",
  "financeofficer@psh.local",
  "user.sohawa@psh.local",
  "user.sukkur@psh.local",
  "user.rehabchakri@psh.local",
  "user.rehabh9@psh.local",
  "auditor@psh.local",
];

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();

  for (const email of DEMO_EMAILS) {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: DEMO_PASSWORD })
      .expect(200);
    sessions.set(email, extractCookies(res));
  }
});

afterAll(async () => {
  await app.close();
});

function cookiesFor(email: string): string[] {
  const cookies = sessions.get(email);
  if (!cookies) throw new Error(`no session established for ${email}`);
  return cookies;
}

describe("login failure modes", () => {
  it("rejects an unknown email", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "nobody@psh.local", password: DEMO_PASSWORD })
      .expect(401);
  });

  it("rejects a wrong password for a real user", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "superadmin@psh.local", password: "wrong-password" })
      .expect(401);
  });

  it("rejects a malformed request body", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "not-an-email", password: "" })
      .expect(400);
  });
});

describe("login sets session cookies", () => {
  it("returns the user and sets access/refresh/csrf cookies", async () => {
    const cookies = cookiesFor("superadmin@psh.local");
    expect(cookies.some((c) => c.startsWith("psh_access_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("psh_refresh_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("psh_csrf_token="))).toBe(true);
  });
});

describe("GET /me and GET /units without a session", () => {
  it("rejects /me with no cookies", async () => {
    await request(app.getHttpServer()).get("/me").expect(401);
  });

  it("rejects /units with no cookies", async () => {
    await request(app.getHttpServer()).get("/units").expect(401);
  });
});

describe("unit scope isolation (Build Plan §5 Phase 1 exit gate)", () => {
  it("Center User - Sohawa sees only PSH-CCS, not other units", async () => {
    const res = await request(app.getHttpServer())
      .get("/units")
      .set("Cookie", cookiesFor("user.sohawa@psh.local"))
      .expect(200);
    const codes = (res.body as Array<{ code: string }>).map((u) => u.code);
    expect(codes).toEqual(["PSH-CCS"]);
  });

  it("Center User - Sukkur sees only PSH-SUK, and specifically not PSH-CCS", async () => {
    const res = await request(app.getHttpServer())
      .get("/units")
      .set("Cookie", cookiesFor("user.sukkur@psh.local"))
      .expect(200);
    const codes = (res.body as Array<{ code: string }>).map((u) => u.code);
    expect(codes).toEqual(["PSH-SUK"]);
    expect(codes).not.toContain("PSH-CCS");
  });

  // The two REHAB units used to share one Project User (both granted at once). Each now
  // gets its own dedicated UNIT_USER, scoped to exactly one — the shared account
  // (user.rehab@psh.local) is deactivated, not reused for either.
  it("Project User - Chakri sees only PSH-REHAB-CHK", async () => {
    const res = await request(app.getHttpServer())
      .get("/units")
      .set("Cookie", cookiesFor("user.rehabchakri@psh.local"))
      .expect(200);
    const codes = (res.body as Array<{ code: string }>).map((u) => u.code);
    expect(codes).toEqual(["PSH-REHAB-CHK"]);
  });

  it("Project User - H-9 Islamabad sees only PSH-REHAB-H9", async () => {
    const res = await request(app.getHttpServer())
      .get("/units")
      .set("Cookie", cookiesFor("user.rehabh9@psh.local"))
      .expect(200);
    const codes = (res.body as Array<{ code: string }>).map((u) => u.code);
    expect(codes).toEqual(["PSH-REHAB-H9"]);
  });

  it.each(["superadmin@psh.local", "financemanager@psh.local", "financeofficer@psh.local", "auditor@psh.local"])(
    "%s (all-unit scope role) sees every active unit, including PSH-ISB",
    async (email) => {
      const res = await request(app.getHttpServer()).get("/units").set("Cookie", cookiesFor(email)).expect(200);
      const codes = (res.body as Array<{ code: string }>).map((u) => u.code);
      expect(codes).toContain("PSH-ISB");
      expect(codes).toHaveLength(10);
    },
  );
});

describe("GET /me reflects the caller's own role and unit scope", () => {
  it("reports UNIT_USER role and narrow scope for Center User - Sohawa", async () => {
    const res = await request(app.getHttpServer())
      .get("/me")
      .set("Cookie", cookiesFor("user.sohawa@psh.local"))
      .expect(200);
    expect(res.body.email).toBe("user.sohawa@psh.local");
    expect(res.body.roleKeys).toEqual(["UNIT_USER"]);
    expect(res.body.unitScope.all).toBe(false);
  });

  it("reports all:true scope for Super Admin", async () => {
    const res = await request(app.getHttpServer())
      .get("/me")
      .set("Cookie", cookiesFor("superadmin@psh.local"))
      .expect(200);
    expect(res.body.unitScope.all).toBe(true);
  });
});

describe("CSRF protection on state-changing auth routes", () => {
  it("rejects /auth/logout without a matching CSRF header", async () => {
    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", cookiesFor("financeofficer@psh.local"))
      .expect(403);
  });

  it("accepts /auth/logout when the CSRF header matches the cookie", async () => {
    const cookies = cookiesFor("financeofficer@psh.local");
    const csrfToken = cookieValue(cookies, "psh_csrf_token");
    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfToken)
      .expect(200);
  });
});
