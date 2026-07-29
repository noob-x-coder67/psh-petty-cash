import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditLogRepository } from "./audit/audit-log.repository";
import { AuthContextRepository } from "./auth/auth-context.repository";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { UnitScopeGuard } from "./guards/unit-scope.guard";
import { LedgerPostingRepository } from "./ledger/ledger-posting.repository";
import { PrismaService } from "./prisma/prisma.service";

const authSecret = process.env.AUTH_SECRET;
if (!authSecret) {
  throw new Error("AUTH_SECRET is not set — refusing to start with an undefined JWT signing secret.");
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: authSecret,
      signOptions: { expiresIn: "15m" },
    }),
    // Global default; /auth/login overrides with a stricter bucket (Build Plan §6.5).
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
  ],
  providers: [
    PrismaService,
    AuthContextRepository,
    LedgerPostingRepository,
    AuditLogRepository,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: UnitScopeGuard },
  ],
  exports: [PrismaService, AuthContextRepository, LedgerPostingRepository, AuditLogRepository, JwtModule],
})
export class CommonModule {}
