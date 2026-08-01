import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EXPENSE_ALL_UNITS, type ExpenseListUnitScope } from "@psh/contracts";
import { Prisma, type ExpenseVoucher } from "@prisma/client";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { LedgerPostingRepository } from "../../common/ledger/ledger-posting.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AccountsRepository } from "../accounts/accounts.repository";
import { CategoriesRepository } from "../categories/categories.repository";
import { MonthCloseRepository } from "../month-close/month-close.repository";
import {
  ExpensesRepository,
  type ExpenseVoucherRegisterRow,
  type ExpenseVoucherWithLines,
  type VoucherListFilters,
} from "./expenses.repository";
import { isBackdated } from "./expenses.rules";

export interface CreateVoucherLineInput {
  description: string;
  categoryId: string;
  amount: string;
  otherExplanation?: string;
}

export interface CreateVoucherInput {
  unitId: string;
  expenseDate: string;
  billDate?: string;
  vendorName: string;
  vendorBillNo?: string;
  justification: string;
  billTotal: string;
  hasBill: boolean;
  missingBillReason?: string;
  lines: CreateVoucherLineInput[];
  enteredBy: AuthenticatedUser;
}

export interface CreateVoucherResult {
  voucher: ExpenseVoucherWithLines;
  balanceWarning: boolean;
  duplicateWarning: boolean;
}

export interface EditVoucherInput {
  voucherId: string;
  reason: string;
  vendorName?: string;
  vendorBillNo?: string;
  billDate?: string;
  justification?: string;
  missingBillReason?: string;
  actor: AuthenticatedUser;
}

export interface ReverseVoucherInput {
  voucherId: string;
  reason: string;
  actor: AuthenticatedUser;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly expensesRepository: ExpensesRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly ledgerPostingRepository: LedgerPostingRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly monthCloseRepository: MonthCloseRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createVoucher(input: CreateVoucherInput): Promise<CreateVoucherResult> {
    const account = await this.accountsRepository.findByUnitId(input.unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${input.unitId} has no petty-cash account`);
    }

    const billTotal = new Prisma.Decimal(input.billTotal);
    const linesSum = input.lines.reduce(
      (sum, line) => sum.plus(new Prisma.Decimal(line.amount)),
      new Prisma.Decimal(0),
    );
    // Service-level enforcement — layer one of BR-005's two layers (the deferred
    // constraint trigger, forced IMMEDIATE below, is the second and final backstop).
    if (!linesSum.equals(billTotal)) {
      throw new BadRequestException(
        `Line total (${linesSum.toFixed(2)}) does not match bill total (${billTotal.toFixed(2)})`,
      );
    }
    if (!input.hasBill && !input.missingBillReason) {
      throw new BadRequestException("missingBillReason is required when hasBill is false");
    }
    const unitCode = await this.expensesRepository.findAccountUnitCode(account.id);
    if (!unitCode) {
      throw new NotFoundException(`Unit for account ${account.id} not found`);
    }

    const expenseDate = new Date(input.expenseDate);
    const duplicates = await this.expensesRepository.findPossibleDuplicates(
      account.id,
      input.vendorName,
      expenseDate,
      billTotal,
    );
    const backdated = isBackdated(expenseDate, new Date());

    const { voucher, balanceAfter } = await this.prisma.$transaction(async (tx) => {
      // Row-locks the account up front, matching Build Plan §2.5's literal transaction
      // order (lock, then guard, then number, then insert) — redundant with
      // postEntryWithTx's own lock later in the same transaction, but harmless (Postgres
      // row locks are reentrant for the holder within one transaction).
      await tx.$queryRaw`SELECT id FROM petty_cash_accounts WHERE id = ${account.id}::uuid FOR UPDATE`;

      await this.assertPeriodNotClosed(account.id, expenseDate, tx);
      await this.assertActiveCategoriesAndExplanations(input.lines, tx);

      const year = expenseDate.getUTCFullYear();
      const lastSeq = await this.expensesRepository.incrementVoucherCounter(account.id, year, tx);
      const voucherNo = `${unitCode}-${year}-${String(lastSeq).padStart(6, "0")}`;

      const created = await this.expensesRepository.createVoucher(
        {
          voucherNo,
          accountId: account.id,
          expenseDate,
          billDate: input.billDate ? new Date(input.billDate) : undefined,
          vendorName: input.vendorName,
          vendorBillNo: input.vendorBillNo,
          justification: input.justification,
          billTotal,
          hasBill: input.hasBill,
          missingBillReason: input.missingBillReason,
          isBackdated: backdated,
          enteredBy: input.enteredBy.id,
        },
        tx,
      );

      for (const [index, line] of input.lines.entries()) {
        await this.expensesRepository.createLine(
          {
            voucherId: created.id,
            lineNo: index + 1,
            description: line.description,
            categoryId: line.categoryId,
            amount: new Prisma.Decimal(line.amount),
            otherExplanation: line.otherExplanation,
          },
          tx,
        );
      }

      // BR-005's second enforcement layer: fails here, inside the transaction, with a
      // precise error, if the trigger-maintained lines_total doesn't match bill_total.
      await this.expensesRepository.enforceTotalsCheckNow(tx);

      // Ledger entry posts in the same transaction as the voucher (NFR-008) — never
      // confirmed before commit. BR-011: negative balance posts normally, no error.
      const ledgerEntry = await this.ledgerPostingRepository.postEntryWithTx(tx, {
        accountId: account.id,
        entryType: "EXPENSE",
        direction: -1,
        amount: billTotal,
        effectiveDate: expenseDate,
        sourceTable: "expense_vouchers",
        sourceId: created.id,
        createdBy: input.enteredBy.id,
      });

      const withBalance = await this.expensesRepository.setBalanceAfter(
        created.id,
        ledgerEntry.balanceAfter,
        tx,
      );

      await this.auditLogRepository.record(tx, {
        actorId: input.enteredBy.id,
        actorRole: input.enteredBy.roleKeys[0] ?? null,
        action: "EXPENSE_CREATE",
        entityType: "expense_vouchers",
        entityId: created.id,
        unitId: account.unitId,
        after: withBalance,
      });

      return { voucher: withBalance, balanceAfter: ledgerEntry.balanceAfter };
    });

    return {
      voucher,
      balanceWarning: balanceAfter.isNegative(),
      duplicateWarning: duplicates.length > 0,
    };
  }

  async getVoucherForUser(
    voucherId: string,
    user: AuthenticatedUser,
  ): Promise<ExpenseVoucherWithLines> {
    const voucher = await this.expensesRepository.findVoucherById(voucherId);
    if (!voucher) {
      throw new NotFoundException(`Voucher ${voucherId} not found`);
    }
    await this.assertUnitScope(voucher.accountId, user);
    return voucher;
  }

  async listVouchersForUser(
    unitScope: ExpenseListUnitScope,
    user: AuthenticatedUser,
    filters: VoucherListFilters,
    cursor?: { expenseDate: string; id: string },
  ): Promise<ExpenseVoucherRegisterRow[]> {
    if (unitScope === EXPENSE_ALL_UNITS) {
      // Defense in depth behind UnitScopeGuard. Both conditions are intentional:
      // Finance Officer/Auditor have broad scope for existing per-unit reads, but the
      // new aggregate Expenses capability belongs only to roles granted this key.
      if (!user.unitScope.all || !user.permissionKeys.includes("expense.view_all_units")) {
        throw new ForbiddenException("All-units expense access is not permitted");
      }
      const accounts = await this.accountsRepository.listAll();
      return this.expensesRepository.listVouchersForAccounts(
        accounts.map((account) => account.id),
        filters,
        cursor ? { expenseDate: new Date(cursor.expenseDate), id: cursor.id } : undefined,
      );
    }

    if (!user.unitScope.all && !user.unitScope.unitIds.includes(unitScope)) {
      throw new ForbiddenException("Unit is outside your authorized scope");
    }
    const account = await this.accountsRepository.findByUnitId(unitScope);
    if (!account) {
      return [];
    }
    return this.expensesRepository.listVouchersForAccounts(
      [account.id],
      filters,
      cursor ? { expenseDate: new Date(cursor.expenseDate), id: cursor.id } : undefined,
    );
  }

  async editVoucher(input: EditVoucherInput): Promise<ExpenseVoucher> {
    const voucher = await this.expensesRepository.findVoucherById(input.voucherId);
    if (!voucher) {
      throw new NotFoundException(`Voucher ${input.voucherId} not found`);
    }
    if (voucher.state !== "ACTIVE") {
      throw new ConflictException("Cannot edit a reversed voucher");
    }

    return this.prisma.$transaction(async (tx) => {
      const fields = {
        ...(input.vendorName !== undefined && { vendorName: input.vendorName }),
        ...(input.vendorBillNo !== undefined && { vendorBillNo: input.vendorBillNo }),
        // input.billDate === "" means the picker was cleared, not "leave unchanged" — only
        // an omitted (undefined) billDate means that. new Date("") is an Invalid Date, so
        // an explicit "" must map to null (clearing the stored date), not a bad Date object.
        ...(input.billDate !== undefined && {
          billDate: input.billDate ? new Date(input.billDate) : null,
        }),
        ...(input.justification !== undefined && { justification: input.justification }),
        ...(input.missingBillReason !== undefined && {
          missingBillReason: input.missingBillReason,
        }),
      };
      const updated = await this.expensesRepository.updateNonFinancialFields(
        input.voucherId,
        fields,
        tx,
      );

      await this.auditLogRepository.record(tx, {
        actorId: input.actor.id,
        actorRole: input.actor.roleKeys[0] ?? null,
        action: "EXPENSE_EDIT",
        entityType: "expense_vouchers",
        entityId: voucher.id,
        unitId: null,
        reason: input.reason,
        before: voucher,
        after: updated,
      });

      return updated;
    });
  }

  async reverseVoucher(input: ReverseVoucherInput): Promise<ExpenseVoucher> {
    const original = await this.expensesRepository.findVoucherById(input.voucherId);
    if (!original) {
      throw new NotFoundException(`Voucher ${input.voucherId} not found`);
    }
    if (original.state !== "ACTIVE") {
      throw new ConflictException("Voucher is already reversed");
    }

    const account = await this.accountsRepository.findById(original.accountId);
    if (!account) {
      throw new NotFoundException(`Account ${original.accountId} not found`);
    }
    const unitCode = await this.expensesRepository.findAccountUnitCode(account.id);
    if (!unitCode) {
      throw new NotFoundException(`Unit for account ${account.id} not found`);
    }
    const originalEntry = await this.expensesRepository.findLedgerEntryForVoucher(original.id);
    if (!originalEntry) {
      throw new NotFoundException(`No ledger entry found for voucher ${original.id}`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM petty_cash_accounts WHERE id = ${account.id}::uuid FOR UPDATE`;

      const now = new Date();
      const year = now.getUTCFullYear();
      const lastSeq = await this.expensesRepository.incrementVoucherCounter(account.id, year, tx);
      const voucherNo = `${unitCode}-${year}-${String(lastSeq).padStart(6, "0")}-REV`;

      // The reversal is itself a full, valid voucher — same lines/total as the
      // original, mirrored for traceability — not a bare ledger adjustment, so it goes
      // through the same total-equality enforcement as any other voucher.
      const reversal = await this.expensesRepository.createVoucher(
        {
          voucherNo,
          accountId: account.id,
          expenseDate: now,
          vendorName: original.vendorName,
          justification: `Reversal of ${original.voucherNo}: ${input.reason}`,
          billTotal: original.billTotal,
          hasBill: true,
          isBackdated: false,
          enteredBy: input.actor.id,
        },
        tx,
      );

      for (const line of original.lines) {
        await this.expensesRepository.createLine(
          {
            voucherId: reversal.id,
            lineNo: line.lineNo,
            description: `Reversal: ${line.description}`,
            categoryId: line.categoryId,
            amount: line.amount,
            otherExplanation: line.otherExplanation ?? undefined,
          },
          tx,
        );
      }

      await this.expensesRepository.enforceTotalsCheckNow(tx);

      const reversalEntry = await this.ledgerPostingRepository.postEntryWithTx(tx, {
        accountId: account.id,
        entryType: "REVERSAL",
        direction: 1,
        amount: original.billTotal,
        effectiveDate: now,
        sourceTable: "expense_vouchers",
        sourceId: reversal.id,
        createdBy: input.actor.id,
        reversesEntryId: originalEntry.id,
      });

      await this.expensesRepository.setBalanceAfter(reversal.id, reversalEntry.balanceAfter, tx);
      const updatedOriginal = await this.expensesRepository.markReversed(
        original.id,
        reversal.id,
        tx,
      );

      await this.auditLogRepository.record(tx, {
        actorId: input.actor.id,
        actorRole: input.actor.roleKeys[0] ?? null,
        action: "EXPENSE_REVERSE",
        entityType: "expense_vouchers",
        entityId: original.id,
        unitId: account.unitId,
        reason: input.reason,
        before: original,
        after: { ...updatedOriginal, reversalVoucherNo: reversal.voucherNo },
      });

      return updatedOriginal;
    });
  }

  // FR-CHK-002: no reason required. FR-CHK-004/005 (BR-008): never touches the balance
  // or implies approval — this only ever writes checked_by/checked_at and the history row.
  async checkVoucher(voucherId: string, actor: AuthenticatedUser): Promise<ExpenseVoucher> {
    const voucher = await this.expensesRepository.findVoucherById(voucherId);
    if (!voucher) {
      throw new NotFoundException(`Voucher ${voucherId} not found`);
    }
    if (voucher.checkedAt) {
      throw new ConflictException("Voucher is already Checked");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.expensesRepository.markChecked(voucherId, actor.id, tx);
      await this.expensesRepository.createCheckEvent(
        { voucherId, action: "CHECKED", actorId: actor.id },
        tx,
      );
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "RECEIPT_CHECK",
        entityType: "expense_vouchers",
        entityId: voucherId,
        unitId: null,
        before: voucher,
        after: updated,
      });
      return updated;
    });
  }

  // FR-DOC-010: reverting to Unchecked requires a mandatory reason.
  async uncheckVoucher(
    voucherId: string,
    reason: string,
    actor: AuthenticatedUser,
  ): Promise<ExpenseVoucher> {
    const voucher = await this.expensesRepository.findVoucherById(voucherId);
    if (!voucher) {
      throw new NotFoundException(`Voucher ${voucherId} not found`);
    }
    if (!voucher.checkedAt) {
      throw new ConflictException("Voucher is not currently Checked");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.expensesRepository.markUnchecked(voucherId, tx);
      await this.expensesRepository.createCheckEvent(
        { voucherId, action: "UNCHECKED", actorId: actor.id, reason },
        tx,
      );
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "RECEIPT_UNCHECK",
        entityType: "expense_vouchers",
        entityId: voucherId,
        unitId: null,
        reason,
        before: voucher,
        after: updated,
      });
      return updated;
    });
  }

  // FR-CHK-006: bulk check only after explicit selection (the caller-supplied list) —
  // vouchers that don't exist or are already Checked are skipped, not treated as errors,
  // since a bulk action over a heterogeneous selection shouldn't fail atomically.
  async bulkCheckVouchers(
    voucherIds: string[],
    actor: AuthenticatedUser,
  ): Promise<{ checked: string[]; skipped: string[] }> {
    const checked: string[] = [];
    const skipped: string[] = [];
    for (const voucherId of voucherIds) {
      const voucher = await this.expensesRepository.findVoucherById(voucherId);
      if (!voucher || voucher.checkedAt) {
        skipped.push(voucherId);
        continue;
      }
      await this.checkVoucher(voucherId, actor);
      checked.push(voucherId);
    }
    return { checked, skipped };
  }

  private async assertUnitScope(accountId: string, user: AuthenticatedUser): Promise<void> {
    if (user.unitScope.all) {
      return;
    }
    const account = await this.accountsRepository.findById(accountId);
    if (!account || !user.unitScope.unitIds.includes(account.unitId)) {
      throw new ForbiddenException("Voucher is outside your authorized scope");
    }
  }

  private async assertActiveCategoriesAndExplanations(
    lines: CreateVoucherLineInput[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const categoryIds = [...new Set(lines.map((line) => line.categoryId))];
    const categories = await this.categoriesRepository.lockRulesForExpenseCreation(categoryIds, tx);
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    for (const line of lines) {
      const category = categoryById.get(line.categoryId);
      if (!category) {
        throw new BadRequestException(`Expense category ${line.categoryId} does not exist`);
      }
      if (!category.isActive) {
        throw new BadRequestException(`Expense category ${category.name} is inactive`);
      }
      if (category.requiresExplanation && (line.otherExplanation?.trim().length ?? 0) < 5) {
        throw new BadRequestException(
          `${category.name} category lines require an explanation of at least 5 characters`,
        );
      }
    }
  }

  // Runs inside the caller's transaction (against tx, not this.prisma) — the account is
  // already row-locked by the time this is called, so the check must happen in the same
  // transaction to avoid a race against a concurrent month-close. periodYear/periodMonth
  // use the same getUTCFullYear/getUTCMonth()+1 convention createVoucher already applies
  // to expenseDate one line later for voucher numbering (expenseDate is a DATE column
  // value with no time component, so no Asia/Karachi conversion applies here — that's
  // only needed when deriving a period from "now", not from an already-a-DATE column).
  private async assertPeriodNotClosed(
    accountId: string,
    expenseDate: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const periodYear = expenseDate.getUTCFullYear();
    const periodMonth = expenseDate.getUTCMonth() + 1;
    const closing = await this.monthCloseRepository.findClosing(
      accountId,
      periodYear,
      periodMonth,
      tx,
    );
    if (closing?.status === "CLOSED") {
      throw new ConflictException(
        `Cannot create a voucher in ${periodYear}-${String(periodMonth).padStart(2, "0")} — this period is closed. Reopen the month first.`,
      );
    }
  }
}
