import { PrismaClient, Prisma } from "@prisma/client";

export interface BalanceDrift {
  accountId: string;
  unitCode: string;
  cachedBalance: string;
  computedBalance: string;
}

/**
 * cached_balance is a cache, never truth — the ledger's summed signed_amount is truth
 * (Build Plan §2.3/§2.5). Recomputes every account's balance from the ledger, corrects
 * any drift found, and returns what it corrected. Run nightly in production; also used
 * as a CI/test assertion (Phase 2 exit gate: zero drift over a 500-entry fixture).
 */
export async function rebuildBalances(prisma: PrismaClient): Promise<BalanceDrift[]> {
  const accounts = await prisma.pettyCashAccount.findMany({ include: { unit: true } });
  const drifts: BalanceDrift[] = [];

  for (const account of accounts) {
    const rows = await prisma.$queryRaw<Array<{ total: Prisma.Decimal | null }>>`
      SELECT SUM(signed_amount) AS total FROM cash_ledger_entries WHERE account_id = ${account.id}::uuid
    `;
    const computed = rows[0]?.total ?? new Prisma.Decimal(0);

    if (!computed.equals(account.cachedBalance)) {
      drifts.push({
        accountId: account.id,
        unitCode: account.unit.code,
        cachedBalance: account.cachedBalance.toFixed(2),
        computedBalance: computed.toFixed(2),
      });
      await prisma.pettyCashAccount.update({
        where: { id: account.id },
        data: { cachedBalance: computed, cachedBalanceAt: new Date() },
      });
    }
  }

  return drifts;
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const prisma = new PrismaClient();
  rebuildBalances(prisma)
    .then(async (drifts) => {
      if (drifts.length > 0) {
        console.log(`Found and corrected drift on ${drifts.length} account(s):`);
        for (const drift of drifts) {
          console.log(`  ${drift.unitCode} (${drift.accountId}): cached=${drift.cachedBalance} computed=${drift.computedBalance}`);
        }
      } else {
        console.log("No drift found — all cached balances match the ledger.");
      }
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
