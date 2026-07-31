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

// Exported so SettingsService (admin read-only configuration screen) can report the
// actually-effective values instead of duplicating these literals.
export const DEFAULT_THROTTLE_TTL_MS = 60_000;
export const DEFAULT_THROTTLE_LIMIT = 100;

@Global()
@Module({
  imports: [
    // Keep bare controller/service imports side-effect free; this factory runs only
    // when Nest actually instantiates the module for an application or integration test.
    JwtModule.registerAsync({
      useFactory: () => {
        const authSecret = process.env.AUTH_SECRET;
        if (!authSecret) {
          throw new Error("AUTH_SECRET is not set — refusing to start with an undefined JWT signing secret.");
        }
        return {
          secret: authSecret,
          signOptions: { expiresIn: "15m" },
        };
      },
    }),
    // Global default; /auth/login overrides with a stricter bucket (Build Plan §6.5).
    ThrottlerModule.forRoot([{ name: "default", ttl: DEFAULT_THROTTLE_TTL_MS, limit: DEFAULT_THROTTLE_LIMIT }]),
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
