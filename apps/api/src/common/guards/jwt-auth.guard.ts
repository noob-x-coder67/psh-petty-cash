import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { AuthContextRepository } from "../auth/auth-context.repository";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthenticatedUser } from "../types/authenticated-user";

export const ACCESS_TOKEN_COOKIE = "psh_access_token";

interface AccessTokenPayload {
  sub: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly authContextRepository: AuthContextRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = (request.cookies as Record<string, string> | undefined)?.[ACCESS_TOKEN_COOKIE];
    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }

    const result = await this.authContextRepository.loadById(payload.sub);
    if (!result.found) {
      throw new UnauthorizedException("User no longer exists");
    }
    if (!result.isActive) {
      throw new UnauthorizedException("Account is inactive");
    }
    if (result.lockedUntil !== null && result.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account is locked");
    }

    request.user = result.context;
    return true;
  }
}
