import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthContextRepository } from "../../common/auth/auth-context.repository";
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

@Injectable()
export class AuthService {
  constructor(
    private readonly authContextRepository: AuthContextRepository,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(params: {
    email: string;
    password: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<SessionTokens> {
    const result = await this.authContextRepository.loadByEmail(params.email);
    const now = new Date();

    if (!result.found) {
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

    if (decision.outcome === "ACCOUNT_INACTIVE") {
      throw new UnauthorizedException("Account is inactive");
    }
    if (decision.outcome === "LOCKED") {
      throw new UnauthorizedException("Account is locked, try again later");
    }
    if (decision.outcome === "INVALID_CREDENTIALS") {
      await this.authRepository.recordFailedLogin(
        result.context.id,
        decision.nextFailedLoginCount,
        decision.nextLockedUntil,
      );
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.authRepository.recordSuccessfulLogin(result.context.id);
    return this.issueSession({ userId: result.context.id, ipAddress: params.ipAddress, userAgent: params.userAgent });
  }

  async refresh(params: {
    refreshToken: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<SessionTokens> {
    const refreshTokenHash = hashToken(params.refreshToken);
    const session = await this.authRepository.findByRefreshTokenHash(refreshTokenHash);
    if (!session) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const now = new Date();
    const decision = evaluateRefresh({ revokedAt: session.revokedAt, expiresAt: session.expiresAt, now });

    if (decision === "REUSE_DETECTED") {
      await this.authRepository.revokeFamily(session.familyId);
      throw new ForbiddenException("Refresh token reuse detected — session revoked");
    }
    if (decision === "EXPIRED") {
      throw new UnauthorizedException("Refresh token expired");
    }

    await this.authRepository.revokeSession(session.id);
    return this.issueSession({
      userId: session.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      familyId: session.familyId,
      expiresAt: session.expiresAt,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshTokenHash = hashToken(refreshToken);
    const session = await this.authRepository.findByRefreshTokenHash(refreshTokenHash);
    if (session) {
      await this.authRepository.revokeFamily(session.familyId);
    }
  }

  private async issueSession(params: {
    userId: string;
    ipAddress: string | null;
    userAgent: string | null;
    familyId?: string;
    expiresAt?: Date;
  }): Promise<SessionTokens> {
    const result = await this.authContextRepository.loadById(params.userId);
    if (!result.found) {
      throw new UnauthorizedException("User no longer exists");
    }

    const familyId = params.familyId ?? randomUUID();
    const expiresAt = params.expiresAt ?? new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const refreshToken = generateToken();

    await this.authRepository.createSession({
      userId: params.userId,
      familyId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    const accessToken = await this.jwtService.signAsync({ sub: params.userId });

    return {
      accessToken,
      refreshToken,
      user: { id: result.context.id, email: result.context.email, fullName: result.context.fullName },
    };
  }
}
