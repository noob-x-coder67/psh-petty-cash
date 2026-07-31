import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Phase 7's exit gate, verbatim from the Build Plan: "Fourth-month replenishment
// blocked when any of three preceding months is not CLOSED; exception recorded with
// actor/reason/time; timeline renders correctly across a year boundary." The
// year-boundary math itself is exhaustively unit-tested in replenishments.rules.spec.ts
// (every rollover case); the hold/exception/override behavior against a real database is
// now covered end-to-end in replenishment-requests.integration.spec.ts (ADR-0010). This
// file proves what didn't move: the compliance timeline read and confirming receipt.

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

describe("GET /compliance/:unitId", () => {
  it("returns a 14-month timeline and the next-replenishment evaluation", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get(`/compliance/${unit.id}`)
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.timeline).toHaveLength(14);
    expect(res.body.nextReplenishment.requiredMonths).toHaveLength(3);
    expect(typeof res.body.nextReplenishment.isCompliant).toBe("boolean");
  });

  it("requires authentication", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    await request(app.getHttpServer()).get(`/compliance/${unit.id}`).expect(401);
  });

  it("a unit-scoped user cannot view another unit's compliance", async () => {
    const otherUnit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer()).get(`/compliance/${otherUnit.id}`).set("Cookie", cookies).expect(403);
  });
});

// ADR-0010: direct-create (POST /replenishments) is gone. Everything that used to be
// covered here — the three-month hold at creation, the exception/override path,
// duplicate-reference conflicts, idempotency replay — now lives in
// replenishment-requests.integration.spec.ts, against the new submit/approve/override
// endpoints. This file keeps only what those endpoints didn't change: the compliance
// timeline (above) and confirming receipt (below), fixture-created via the override
// path since it's the equivalent single-step atomic creation the old direct-create was.

describe("POST /replenishments/:id/confirm", () => {
  // PSH-SUK — ADR-0008 removed allocation.confirm_receipt from Finance Manager/Super
  // Admin, and PSH-SUK has a seeded UNIT_USER (user.sukkur) able to confirm on its
  // behalf. PSH-SUK has no real-dated monthly closings (only synthetic far-future ones
  // elsewhere in this suite), so it's genuinely BR-013-held for "now" and the override
  // path accepts it — the three-month hold isn't what's under test here.
  it("posts a REPLENISHMENT ledger entry and updates the account balance", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const before = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { id: account.id } });

    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/replenishment-requests/override")
      .set("Cookie", financeManagerCookies)
      .send({
        unitId: unit.id,
        amount: "1234.56",
        reason: "confirm-flow test",
        issueDate: "2026-06-01",
        exceptionReason: "confirm-flow test",
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    const replenishmentId = createRes.body.replenishmentId as string;

    const sukkurCookies = await loginAs("user.sukkur@psh.local");
    await request(app.getHttpServer())
      .post(`/replenishments/${replenishmentId}/confirm`)
      .set("Cookie", sukkurCookies)
      .send({ confirmedDate: "2026-06-02" })
      .expect(201);

    const ledgerEntries = await prisma.cashLedgerEntry.findMany({
      where: { sourceTable: "replenishments", sourceId: replenishmentId },
    });
    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0]?.entryType).toBe("REPLENISHMENT");
    expect(ledgerEntries[0]?.direction).toBe(1);

    const after = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(after.cachedBalance.toFixed(2)).toBe(before.cachedBalance.plus("1234.56").toFixed(2));
  });

  it("rejects confirming the same replenishment twice", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/replenishment-requests/override")
      .set("Cookie", financeManagerCookies)
      .send({
        unitId: unit.id,
        amount: "100.00",
        reason: "double-confirm test",
        issueDate: "2026-06-01",
        exceptionReason: "double-confirm test",
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    const replenishmentId = createRes.body.replenishmentId as string;

    const sukkurCookies = await loginAs("user.sukkur@psh.local");
    await request(app.getHttpServer())
      .post(`/replenishments/${replenishmentId}/confirm`)
      .set("Cookie", sukkurCookies)
      .send({ confirmedDate: "2026-06-02" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/replenishments/${replenishmentId}/confirm`)
      .set("Cookie", sukkurCookies)
      .send({ confirmedDate: "2026-06-02" })
      .expect(409);
  });

  it("Finance Manager gets 403 confirming a replenishment (ADR-0008)", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/replenishment-requests/override")
      .set("Cookie", financeManagerCookies)
      .send({
        unitId: unit.id,
        amount: "100.00",
        reason: "ADR-0008 negative-permission test",
        issueDate: "2026-06-01",
        exceptionReason: "ADR-0008 negative-permission test",
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    const replenishmentId = createRes.body.replenishmentId as string;

    await request(app.getHttpServer())
      .post(`/replenishments/${replenishmentId}/confirm`)
      .set("Cookie", financeManagerCookies)
      .send({ confirmedDate: "2026-06-02" })
      .expect(403);
  });
});
