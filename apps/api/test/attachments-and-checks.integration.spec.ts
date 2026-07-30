import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { AttachmentsService } from "../src/modules/attachments/attachments.service";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL. Proves Phase 4's exit gate (Build Plan §5): unauthorized cross-unit view
// is 403'd, byte deletion leaves voucher/metadata intact, and Checked never moves the
// balance — plus the surrounding FR-DOC/FR-CHK behaviour (magic-byte sniffing, mandatory
// uncheck reason, bulk-check, history rows).

let app: INestApplication;
let prisma: PrismaService;
let attachmentsService: AttachmentsService;
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
  attachmentsService = app.get(AttachmentsService);
});

afterAll(async () => {
  await app.close();
});

async function createVoucher(unitCode: string, cookies: string[]) {
  const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: unitCode } });
  const res = await request(app.getHttpServer())
    .post("/expenses")
    .set("Cookie", cookies)
    .send({
      unitId: unit.id,
      expenseDate: "2026-07-15",
      vendorName: "Attachments Test Vendor",
      justification: "Testing attachment and check behaviour",
      billTotal: "50.00",
      hasBill: true,
      lines: [{ description: "Item", category: "BUILDING", amount: "50.00" }],
    })
    .expect(201);
  return res.body.voucher as { id: string };
}

describe("attachment upload (FR-DOC-001/002/006)", () => {
  it("accepts a real JPEG and records checksum/uploader/mimeType", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const voucher = await createVoucher("PSH-SOH", cookies);
    const jpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 10, b: 10 } } })
      .jpeg()
      .toBuffer();

    const res = await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/attachments`)
      .set("Cookie", cookies)
      .attach("file", jpeg, "bill.jpg")
      .expect(201);

    expect(res.body.mimeType).toBe("image/jpeg");
    expect(typeof res.body.sha256).toBe("string");
    expect(res.body.sha256.length).toBeGreaterThan(0);
    expect(res.body.uploadedBy).toBeDefined();
    expect(res.body.driver).toBe("POSTGRES_BYTEA");
    // The raw bytes are never echoed back — the client only needs metadata to build a
    // view/download link, and doubling every upload's payload with its own bytes would
    // be wasteful (same reasoning as excluding them from the audit trail).
    expect(res.body.data).toBeUndefined();
    expect(res.body.storageKey).toBeUndefined();
  });

  it("accepts a real PDF", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const voucher = await createVoucher("PSH-SOH", cookies);
    const pdf = Buffer.from("%PDF-1.4\n%mock pdf content for magic-byte sniffing test\n%%EOF");

    const res = await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/attachments`)
      .set("Cookie", cookies)
      .attach("file", pdf, "bill.pdf")
      .expect(201);

    expect(res.body.mimeType).toBe("application/pdf");
  });

  it("rejects a renamed non-image/PDF file — magic bytes, not the extension, are checked", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const voucher = await createVoucher("PSH-SOH", cookies);
    const fakeImage = Buffer.from("this is plain text pretending to be a jpeg");

    await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/attachments`)
      .set("Cookie", cookies)
      .attach("file", fakeImage, "bill.jpg")
      .expect(400);
  });
});

describe("authorized view/download and cross-unit 403 (AC-016, Phase 4 exit gate)", () => {
  it("an authorized same-unit user can view and download", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const voucher = await createVoucher("PSH-SOH", cookies);
    const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .jpeg()
      .toBuffer();
    const uploadRes = await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/attachments`)
      .set("Cookie", cookies)
      .attach("file", jpeg, "receipt.jpg")
      .expect(201);

    const viewRes = await request(app.getHttpServer())
      .get(`/attachments/${uploadRes.body.id}/view`)
      .set("Cookie", cookies)
      .expect(200);
    expect(viewRes.headers["content-disposition"]).toContain("inline");
    expect(viewRes.headers["x-content-type-options"]).toBe("nosniff");

    const downloadRes = await request(app.getHttpServer())
      .get(`/attachments/${uploadRes.body.id}/download`)
      .set("Cookie", cookies)
      .expect(200);
    expect(downloadRes.headers["content-disposition"]).toContain("attachment");
  });

  it("a user from another unit gets 403 on /attachments/:id/view", async () => {
    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    const voucher = await createVoucher("PSH-SOH", sohawaCookies);
    const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 5, g: 5, b: 5 } } })
      .jpeg()
      .toBuffer();
    const uploadRes = await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/attachments`)
      .set("Cookie", sohawaCookies)
      .attach("file", jpeg, "receipt.jpg")
      .expect(201);

    const sukkurCookies = await loginAs("user.sukkur@psh.local");
    await request(app.getHttpServer())
      .get(`/attachments/${uploadRes.body.id}/view`)
      .set("Cookie", sukkurCookies)
      .expect(403);
  });
});

describe("byte deletion mechanism (BR-014, BR-015, FR-DOC-013)", () => {
  it("deleting bytes clears storage columns but leaves the row, its metadata, and the voucher intact", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const voucher = await createVoucher("PSH-SOH", cookies);
    const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 9, g: 9, b: 9 } } })
      .jpeg()
      .toBuffer();
    const uploadRes = await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/attachments`)
      .set("Cookie", cookies)
      .attach("file", jpeg, "receipt.jpg")
      .expect(201);

    const financeManagerUser = await prisma.user.findUniqueOrThrow({ where: { email: "financemanager@psh.local" } });
    await attachmentsService.deleteBytes(uploadRes.body.id, {
      id: financeManagerUser.id,
      email: financeManagerUser.email,
      fullName: financeManagerUser.fullName,
      mustChangePassword: financeManagerUser.mustChangePassword,
      roleKeys: ["FINANCE_MANAGER"],
      permissionKeys: [],
      unitScope: { all: true, unitIds: [] },
    });

    const afterDelete = await prisma.attachment.findUniqueOrThrow({ where: { id: uploadRes.body.id } });
    expect(afterDelete.data).toBeNull();
    expect(afterDelete.storageKey).toBeNull();
    expect(afterDelete.deletedAt).not.toBeNull();
    expect(afterDelete.deletedBy).toBe(financeManagerUser.id);
    // Metadata survives (FR-DOC-013).
    expect(afterDelete.fileName).toBe("receipt.jpg");
    expect(afterDelete.mimeType).toBe("image/jpeg");
    expect(afterDelete.sha256.length).toBeGreaterThan(0);

    const voucherAfter = await prisma.expenseVoucher.findUniqueOrThrow({ where: { id: voucher.id } });
    expect(voucherAfter.billTotal.toFixed(2)).toBe("50.00");
    expect(voucherAfter.state).toBe("ACTIVE");
  });
});

describe("Checked/Unchecked (BR-008, FR-CHK-001..007)", () => {
  it("Checked never moves the balance and requires no reason", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const voucher = await createVoucher("PSH-SOH", cookies);
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const before = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });

    const financeOfficerCookies = await loginAs("financeofficer@psh.local");
    const res = await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/check`)
      .set("Cookie", financeOfficerCookies)
      .send({})
      .expect(201);

    expect(res.body.checkedAt).not.toBeNull();
    expect(res.body.checkedBy).toBeDefined();

    const after = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    expect(after.cachedBalance.toFixed(2)).toBe(before.cachedBalance.toFixed(2));

    const events = await prisma.receiptCheckEvent.findMany({ where: { voucherId: voucher.id, action: "CHECKED" } });
    expect(events).toHaveLength(1);
    expect(events[0]?.reason).toBeNull();

    const auditEntries = await prisma.auditLog.findMany({
      where: { entityType: "expense_vouchers", entityId: voucher.id, action: "RECEIPT_CHECK" },
    });
    expect(auditEntries).toHaveLength(1);
  });

  it("a Center User cannot mark Checked (permission-gated to Finance/Super Admin)", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const voucher = await createVoucher("PSH-SOH", cookies);

    await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/check`)
      .set("Cookie", cookies)
      .send({})
      .expect(403);
  });

  it("reverting to Unchecked requires a reason and is recorded in history", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const voucher = await createVoucher("PSH-SOH", cookies);
    const financeOfficerCookies = await loginAs("financeofficer@psh.local");

    await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/check`)
      .set("Cookie", financeOfficerCookies)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/uncheck`)
      .set("Cookie", financeOfficerCookies)
      .send({})
      .expect(400);

    const uncheckRes = await request(app.getHttpServer())
      .post(`/expenses/${voucher.id}/uncheck`)
      .set("Cookie", financeOfficerCookies)
      .send({ reason: "Receipt was actually illegible, reverting" })
      .expect(201);

    expect(uncheckRes.body.checkedAt).toBeNull();

    const events = await prisma.receiptCheckEvent.findMany({
      where: { voucherId: voucher.id },
      orderBy: { actedAt: "asc" },
    });
    expect(events).toHaveLength(2);
    expect(events[0]?.action).toBe("CHECKED");
    expect(events[1]?.action).toBe("UNCHECKED");
    expect(events[1]?.reason).toBe("Receipt was actually illegible, reverting");
  });

  it("bulk-check marks all unchecked vouchers and skips ones already Checked", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const voucherA = await createVoucher("PSH-SOH", cookies);
    const voucherB = await createVoucher("PSH-SOH", cookies);
    const financeOfficerCookies = await loginAs("financeofficer@psh.local");

    await request(app.getHttpServer())
      .post(`/expenses/${voucherA.id}/check`)
      .set("Cookie", financeOfficerCookies)
      .send({})
      .expect(201);

    const bulkRes = await request(app.getHttpServer())
      .post("/expenses/bulk-check")
      .set("Cookie", financeOfficerCookies)
      .send({ voucherIds: [voucherA.id, voucherB.id] })
      .expect(201);

    expect(bulkRes.body.checked).toEqual([voucherB.id]);
    expect(bulkRes.body.skipped).toEqual([voucherA.id]);

    const voucherBAfter = await prisma.expenseVoucher.findUniqueOrThrow({ where: { id: voucherB.id } });
    expect(voucherBAfter.checkedAt).not.toBeNull();
  });
});
