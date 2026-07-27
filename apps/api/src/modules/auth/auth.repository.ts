import { Injectable } from "@nestjs/common";
import type { Prisma, Session } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

type Client = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    params: {
      userId: string;
      familyId: string;
      refreshTokenHash: string;
      expiresAt: Date;
      ipAddress: string | null;
      userAgent: string | null;
    },
    client: Client = this.prisma,
  ): Promise<Session> {
    return client.session.create({ data: params });
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { refreshTokenHash } });
  }

  async revokeSession(id: string, client: Client = this.prisma): Promise<void> {
    await client.session.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeFamily(familyId: string, client: Client = this.prisma): Promise<void> {
    await client.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async recordFailedLogin(
    userId: string,
    failedLoginCount: number,
    lockedUntil: Date | null,
    client: Client = this.prisma,
  ): Promise<void> {
    await client.user.update({
      where: { id: userId },
      data: { failedLoginCount, lockedUntil },
    });
  }

  async recordSuccessfulLogin(userId: string, client: Client = this.prisma): Promise<void> {
    await client.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }
}
