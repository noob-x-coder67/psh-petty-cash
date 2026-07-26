import { Injectable } from "@nestjs/common";
import type { Session } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(params: {
    userId: string;
    familyId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<Session> {
    return this.prisma.session.create({ data: params });
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { refreshTokenHash } });
  }

  async revokeSession(id: string): Promise<void> {
    await this.prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async recordFailedLogin(userId: string, failedLoginCount: number, lockedUntil: Date | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount, lockedUntil },
    });
  }

  async recordSuccessfulLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }
}
