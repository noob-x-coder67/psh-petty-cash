import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";

// Build Plan §5.1: "Phase 6 depends on Phase 3 data existing in volume; seed 50k
// synthetic vouchers at the start of Phase 6 so NFR-002/003 are measured against
// realistic cardinality, not a demo dataset of forty rows." No distribution/edge-case
// proportions are specified anywhere — the shape below (vendor concentration, category
// split, unchecked/missing-bill/backdated/negative-balance/near-duplicate proportions)
// is this script's own design, chosen so every RPT-* report has something meaningful to
// aggregate, not just row count.
//
// Bypasses the API/service layer entirely for speed (50k vouchers through
// ExpensesService's full per-voucher transaction — row lock, audit write, deferred
// constraint round trip — would take far too long as a one-off maintenance script).
// Still respects every structural invariant a real voucher must have: lines_total is
// left to the recompute_voucher_lines_total() trigger (fires the same way on
// createMany as on individual inserts), the deferred ck_voucher_totals constraint is
// forced IMMEDIATE per batch exactly like ExpensesRepository.enforceTotalsCheckNow,
// and balance_after is chained correctly in expense-date order per account. This is a
// one-off volume seed, not idempotent — rerunning it adds another 50,000 rows on top.

// Overridable for scratch-DB smoke testing (SEED_VOLUME_TOTAL=200) — defaults to the
// real Phase 6 target.
const TOTAL_VOUCHERS = Number(process.env.SEED_VOLUME_TOTAL ?? 50_000);
const BATCH_SIZE = 500;
const SPREAD_DAYS = 365;
// PSH-BHW is the integration suite's dedicated Month Close fixture. Its live
// expected balance must remain physically countable, so volume data belongs on
// the other accounts rather than contaminating that cross-module fixture.
const VOLUME_EXCLUDED_UNIT_CODES = new Set(["PSH-BHW"]);

// Repetition = weight, a cheap way to get a Zipf-ish "a few vendors dominate" spread
// for RPT-05 (Vendor/Payee Analysis) to have something worth ranking.
const VENDOR_POOL = [
  "Al-Fateh Hardware",
  "Al-Fateh Hardware",
  "Al-Fateh Hardware",
  "Highway Fuel Station",
  "Highway Fuel Station",
  "Highway Fuel Station",
  "City Electric Supplies",
  "City Electric Supplies",
  "Sohawa General Store",
  "Sohawa General Store",
  "Metro Cash & Carry",
  "Punjab Auto Parts",
  "Al-Noor Plumbing Services",
  "Sukkur Building Materials",
  "National Motors Workshop",
  "Green Valley Grocers",
  "Rawalpindi Paint House",
  "Islamabad Office Supplies",
  "Bhalwal Timber Merchants",
  "AJK Electrical Traders",
  "Chakri Fuel & Gas",
  "H-9 Maintenance Services",
  "Liaquat Bagh Hardware",
  "Raja Bazaar Traders",
  "Cadet College Canteen Supplies",
  "Sweet Home Kitchen Supplies",
  "Al-Madina Tyre Shop",
  "Zam Zam Water Supply",
];

function pick<T>(pool: readonly T[]): T {
  const item = pool[Math.floor(Math.random() * pool.length)];
  if (item === undefined) throw new Error("pool is empty");
  return item;
}

interface ManagedCategory {
  id: string;
  name: string;
  requiresExplanation: boolean;
}

// 70% small/common, 25% medium, 5% occasionally large enough to push a balance
// negative (RPT-07 needs some real negative-balance events to report on).
function randomAmount(): Prisma.Decimal {
  const roll = Math.random();
  let value: number;
  if (roll < 0.7) {
    value = 200 + Math.random() * 2800;
  } else if (roll < 0.95) {
    value = 3000 + Math.random() * 12000;
  } else {
    value = 15000 + Math.random() * 60000;
  }
  // Cash Count v1 supports whole-rupee notes down to PKR 10. Keep synthetic
  // balances exactly decomposable so the volume fixture and Month Close's
  // denomination invariant can coexist in the same integration database.
  return new Prisma.Decimal(Math.round(value / 10) * 10);
}

function sortedRandomDates(count: number, now: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const offsetDays = Math.floor(Math.random() * SPREAD_DAYS);
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offsetDays);
    date.setUTCHours(0, 0, 0, 0);
    dates.push(date);
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

interface VoucherRow {
  id: string;
  voucherNo: string;
  accountId: string;
  expenseDate: Date;
  vendorName: string;
  justification: string;
  billTotal: Prisma.Decimal;
  hasBill: boolean;
  missingBillReason: string | null;
  isBackdated: boolean;
  balanceAfter: Prisma.Decimal;
  enteredBy: string;
  checkedBy: string | null;
  checkedAt: Date | null;
}

interface LineRow {
  voucherId: string;
  lineNo: number;
  description: string;
  categoryId: string;
  amount: Prisma.Decimal;
  otherExplanation: string | null;
}

interface LedgerRow {
  accountId: string;
  entryType: "EXPENSE";
  direction: number;
  amount: Prisma.Decimal;
  effectiveDate: Date;
  sourceTable: string;
  sourceId: string;
  balanceAfter: Prisma.Decimal;
  createdBy: string;
}

async function ensureAccountsForAllUnits(prisma: PrismaClient, actorId: string): Promise<void> {
  const eligibleUnits = await prisma.organizationalUnit.findMany({
    where: { pettyCashEnabled: true },
    include: { pettyCashAccount: true },
  });
  for (const unit of eligibleUnits) {
    if (!unit.pettyCashAccount) {
      await prisma.pettyCashAccount.create({ data: { unitId: unit.id } });
      console.log(`Enabled a petty-cash account for ${unit.code} (was missing one).`);
    }
  }
  void actorId;
}

async function seedAccountVouchers(
  prisma: PrismaClient,
  account: { id: string; cachedBalance: Prisma.Decimal; unit: { code: string } },
  count: number,
  enteredBy: string,
  now: Date,
  categories: readonly ManagedCategory[],
): Promise<void> {
  let runningBalance = account.cachedBalance;
  const yearCounters = new Map<number, number>();
  const existingCounters = await prisma.voucherCounter.findMany({ where: { accountId: account.id } });
  for (const counter of existingCounters) {
    yearCounters.set(counter.year, counter.lastSeq);
  }

  const dates = sortedRandomDates(count, now);
  let previousVendor: string | null = null;
  let previousAmount: Prisma.Decimal | null = null;
  let previousDate: Date | null = null;

  for (let batchStart = 0; batchStart < dates.length; batchStart += BATCH_SIZE) {
    const batchDates = dates.slice(batchStart, batchStart + BATCH_SIZE);
    const voucherRows: VoucherRow[] = [];
    const lineRows: LineRow[] = [];
    const ledgerRows: LedgerRow[] = [];
    const yearsTouched = new Set<number>();

    for (const expenseDate of batchDates) {
      const year = expenseDate.getUTCFullYear();
      const lastSeq = (yearCounters.get(year) ?? 0) + 1;
      yearCounters.set(year, lastSeq);
      yearsTouched.add(year);

      const voucherId = randomUUID();
      const voucherNo = `${account.unit.code}-${year}-${String(lastSeq).padStart(6, "0")}-SYN`;

      // ~2% near-duplicate of the immediately preceding voucher (RPT-11 needs real
      // vendor+date+amount collisions to detect, not just random noise).
      const isDuplicateRoll = Math.random() < 0.02 && previousVendor && previousAmount && previousDate;
      const vendorName = isDuplicateRoll ? (previousVendor as string) : pick(VENDOR_POOL);
      const billTotal = isDuplicateRoll ? (previousAmount as Prisma.Decimal) : randomAmount();
      const category = pick(categories);
      const hasBill = Math.random() > 0.05;
      // A separate, direct probability, not the real isBackdated() working-day
      // calculation — this script bulk-inserts a full year of history in one pass, so
      // "how old is this expense_date" isn't a meaningful proxy for "was this entered
      // late" the way it is for a real, one-at-a-time voucher entered close to its date.
      const isBackdated = Math.random() < 0.04;
      const isChecked = Math.random() > 0.15;

      runningBalance = runningBalance.minus(billTotal);

      voucherRows.push({
        id: voucherId,
        voucherNo,
        accountId: account.id,
        expenseDate,
        vendorName,
        justification: "Synthetic Phase 6 volume-seed entry for NFR-002/003 performance testing",
        billTotal,
        hasBill,
        missingBillReason: hasBill ? null : "Synthetic seed: bill not retained",
        isBackdated,
        balanceAfter: runningBalance,
        enteredBy,
        checkedBy: isChecked ? enteredBy : null,
        checkedAt: isChecked ? expenseDate : null,
      });
      lineRows.push({
        voucherId,
        lineNo: 1,
        description: `Synthetic ${category.name.toLowerCase()} expense`,
        categoryId: category.id,
        amount: billTotal,
        otherExplanation: category.requiresExplanation ? "Synthetic seed: category explanation" : null,
      });
      ledgerRows.push({
        accountId: account.id,
        entryType: "EXPENSE",
        direction: -1,
        amount: billTotal,
        effectiveDate: expenseDate,
        sourceTable: "expense_vouchers",
        sourceId: voucherId,
        balanceAfter: runningBalance,
        createdBy: enteredBy,
      });

      previousVendor = vendorName;
      previousAmount = billTotal;
      previousDate = expenseDate;
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.expenseVoucher.createMany({ data: voucherRows });
        await tx.expenseLine.createMany({ data: lineRows });
        // Forces the deferred BR-005 constraint trigger now, inside this batch's
        // transaction — same mechanism ExpensesRepository.enforceTotalsCheckNow uses.
        await tx.$executeRawUnsafe("SET CONSTRAINTS ck_voucher_totals IMMEDIATE");
        await tx.cashLedgerEntry.createMany({ data: ledgerRows });
        for (const year of yearsTouched) {
          await tx.voucherCounter.upsert({
            where: { accountId_year: { accountId: account.id, year } },
            create: { accountId: account.id, year, lastSeq: yearCounters.get(year) ?? 0 },
            update: { lastSeq: yearCounters.get(year) ?? 0 },
          });
        }
      },
      { timeout: 30_000 },
    );

    console.log(
      `  ${account.unit.code}: ${Math.min(batchStart + BATCH_SIZE, dates.length)}/${dates.length} vouchers`,
    );
  }

  await prisma.pettyCashAccount.update({
    where: { id: account.id },
    data: { cachedBalance: runningBalance, cachedBalanceAt: new Date() },
  });
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const superAdmin = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@psh.local" } });
  const categories = await prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, requiresExplanation: true },
  });
  if (categories.length === 0) {
    throw new Error(
      "No active managed expense categories found — activate at least one category before volume seeding.",
    );
  }

  await ensureAccountsForAllUnits(prisma, superAdmin.id);

  const accounts = (await prisma.pettyCashAccount.findMany({ include: { unit: true } })).filter(
    (account) => !VOLUME_EXCLUDED_UNIT_CODES.has(account.unit.code),
  );
  if (accounts.length === 0) {
    throw new Error("No petty-cash accounts found even after ensureAccountsForAllUnits — check seed data.");
  }

  const perAccount = Math.floor(TOTAL_VOUCHERS / accounts.length);
  const now = new Date();

  console.log(`Seeding ~${perAccount} synthetic vouchers across ${accounts.length} accounts...`);
  for (const account of accounts) {
    await seedAccountVouchers(prisma, account, perAccount, superAdmin.id, now, categories);
  }

  console.log(`Done — seeded ${perAccount * accounts.length} synthetic vouchers.`);
  await prisma.$disconnect();
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch(async (error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
