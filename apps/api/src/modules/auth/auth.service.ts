import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Prisma } from "@prisma/client";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { AuthContextRepository } from "../../common/auth/auth-context.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import { verifyPassword } from "../../common/security/password";
import { AuthRepository } from "./auth.repository";
import { evaluateLogin, evaluateRefresh } from "./auth.rules";

// Absolute session cap (Build Plan §6.1: "absolute cap 12h").
const REFRESH_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

// A syntactically valid but unreachable hash, verified against on an unknown email so
// login timing doesn't reveal whether the address exists.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string };
}

interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authContextRepository: AuthContextRepository,
    private readonly authRepository: AuthRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(params: { email: string; password: string } & RequestContext): Promise<SessionTokens> {
    const result = await this.authContextRepository.loadByEmail(params.email);
    const now = new Date();

    if (!result.found) {
      // No real entity to audit against (BR-016-style: don't invent a row for an
      // account that doesn't exist) — the rate limiter is the control here instead.
      await verifyPassword(DUMMY_HASH, params.password);
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordMatches = await verifyPassword(result.passwordHash, params.password);
    const decision = evaluateLogin({
      isActive: result.isActive,
      lockedUntil: result.lockedUntil,
      failedLoginCount: result.failedLoginCount,
      passwordMatches,
      now,
    });

    if (decision.outcome === "ACCOUNT_INACTIVE" || decision.outcome === "LOCKED") {
      await this.auditFailedLogin(result.context.id, result.context.roleKeys[0] ?? null, decision.outcome, params);
      throw new UnauthorizedException(
        decision.outcome === "ACCOUNT_INACTIVE" ? "Account is inactive" : "Account is locked, try again later",
      );
    }
    if (decision.outcome === "INVALID_CREDENTIALS") {
      await this.prisma.$transaction(async (tx) => {
        await this.authRepository.recordFailedLogin(
          result.context.id,
          decision.nextFailedLoginCount,
          decision.nextLockedUntil,
          tx,
        );
        await this.auditLogRepository.record(tx, {
          actorId: result.context.id,
          actorRole: result.context.roleKeys[0] ?? null,
          action: "LOGIN_FAILURE",
          entityType: "users",
          entityId: result.context.id,
          unitId: null,
          reason: "INVALID_CREDENTIALS",
          ip: params.ipAddress,
          userAgent: params.userAgent,
        });
      });
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.prisma.$transaction(async (tx) => {
      await this.authRepository.recordSuccessfulLogin(result.context.id, tx);
      await this.auditLogRepository.record(tx, {
        actorId: result.context.id,
        actorRole: result.context.roleKeys[0] ?? null,
        action: "LOGIN_SUCCESS",
        entityType: "users",
        entityId: result.context.id,
        unitId: null,
        ip: params.ipAddress,
        userAgent: params.userAgent,
      });
      return this.issueSession(tx, { userId: result.context.id, ipAddress: params.ipAddress, userAgent: params.userAgent });
    });
  }

  async refresh(params: { refreshToken: string } & RequestContext): Promise<SessionTokens> {
    const refreshTokenHash = hashToken(params.refreshToken);
    const session = await this.authRepository.findByRefreshTokenHash(refreshTokenHash);
    if (!session) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const now = new Date();
    const decision = evaluateRefresh({ revokedAt: session.revokedAt, expiresAt: session.expiresAt, now });

    if (decision === "REUSE_DETECTED") {
      await this.prisma.$transaction(async (tx) => {
        await this.authRepository.revokeFamily(session.familyId, tx);
        await this.auditLogRepository.record(tx, {
          actorId: session.userId,
          actorRole: null,
          action: "SESSION_REUSE_DETECTED",
          entityType: "sessions",
          entityId: session.id,
          unitId: null,
          reason: "Refresh token reuse detected — whole session family revoked",
          ip: params.ipAddress,
          userAgent: params.userAgent,
        });
      });
      throw new ForbiddenException("Refresh token reuse detected — session revoked");
    }
    if (decision === "EXPIRED") {
      throw new UnauthorizedException("Refresh token expired");
    }

    return this.prisma.$transaction(async (tx) => {
      await this.authRepository.revokeSession(session.id, tx);
      return this.issueSession(tx, {
        userId: session.userId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        familyId: session.familyId,
        expiresAt: session.expiresAt,
      });
    });
  }

  async logout(refreshToken: string, requestContext: RequestContext): Promise<void> {
    const refreshTokenHash = hashToken(refreshToken);
    const session = await this.authRepository.findByRefreshTokenHash(refreshTokenHash);
    if (!session) {
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await this.authRepository.revokeFamily(session.familyId, tx);
      await this.auditLogRepository.record(tx, {
        actorId: session.userId,
        actorRole: null,
        action: "LOGOUT",
        entityType: "sessions",
        entityId: session.id,
        unitId: null,
        ip: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });
    });
  }

  private async auditFailedLogin(
    actorId: string,
    actorRole: string | null,
    outcome: string,
    context: RequestContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.auditLogRepository.record(tx, {
        actorId,
        actorRole,
        action: "LOGIN_FAILURE",
        entityType: "users",
        entityId: actorId,
        unitId: null,
        reason: outcome,
        ip: context.ipAddress,
        userAgent: context.userAgent,
      });
    });
  }

  private async issueSession(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      ipAddress: string | null;
      userAgent: string | null;
      familyId?: string;
      expiresAt?: Date;
    },
  ): Promise<SessionTokens> {
    const result = await this.authContextRepository.loadById(params.userId);
    if (!result.found) {
      throw new UnauthorizedException("User no longer exists");
    }

    const familyId = params.familyId ?? randomUUID();
    const expiresAt = params.expiresAt ?? new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const refreshToken = generateToken();

    await this.authRepository.createSession(
      {
        userId: params.userId,
        familyId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
      tx,
    );

    const accessToken = await this.jwtService.signAsync({ sub: params.userId });

    return {
      accessToken,
      refreshToken,
      user: { id: result.context.id, email: result.context.email, fullName: result.context.fullName },
    };
  }
}
