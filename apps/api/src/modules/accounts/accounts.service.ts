import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PettyCashAccount } from "@prisma/client";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AccountsRepository } from "./accounts.repository";

@Injectable()
export class AccountsService {
  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async enableAccount(unitId: string, actor: AuthenticatedUser): Promise<PettyCashAccount> {
    const unit = await this.accountsRepository.findUnitById(unitId);
    if (!unit) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    // Service-level guard — the first of three independent layers (Build Plan §2.3).
    // The composite FK (fk_account_requires_enabled_unit) is the layer that still
    // holds even if this check is ever bypassed or buggy.
    if (!unit.pettyCashEnabled) {
      throw new BadRequestException(`Unit ${unit.code} is not petty-cash enabled`);
    }
    const existing = await this.accountsRepository.findByUnitId(unitId);
    if (existing) {
      throw new ConflictException(`Unit ${unit.code} already has a petty-cash account`);
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await this.accountsRepository.create(unitId, tx);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "ACCOUNT_ENABLE",
        entityType: "petty_cash_accounts",
        entityId: account.id,
        unitId: unit.id,
        after: account,
      });
      return account;
    });
  }

  async getAccountForUser(accountId: string, user: AuthenticatedUser): Promise<PettyCashAccount> {
    const account = await this.accountsRepository.findById(accountId);
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }
    if (!user.unitScope.all && !user.unitScope.unitIds.includes(account.unitId)) {
      throw new ForbiddenException("Account is outside your authorized scope");
    }
    return account;
  }
}
