import { randomBytes } from "node:crypto";
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { LoginRequestSchema, type LoginRequest } from "@psh/contracts";
import type { CookieOptions, Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CSRF_TOKEN_COOKIE, CsrfGuard } from "../../common/guards/csrf.guard";
import { ACCESS_TOKEN_COOKIE } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

const REFRESH_TOKEN_COOKIE = "psh_refresh_token";
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function cookieOptions(maxAgeMs: number, httpOnly: boolean): CookieOptions {
  return {
    httpOnly,
    secure: process.env.APP_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeMs,
    path: "/",
  };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  // Per-IP net against email-spray attacks — deliberately looser than the per-account
  // lockout threshold (auth.rules.ts LOCKOUT_THRESHOLD=5), which is the tighter,
  // account-specific control. These are two distinct mechanisms (Build Plan §6.1).
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const result = await this.authService.login({
      email: body.email,
      password: body.password,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });
    this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ user: SessionUser }> {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const result = await this.authService.refresh({
      refreshToken,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });
    this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @UseGuards(CsrfGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
      await this.authService.logout(refreshToken, {
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });
    }
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
    res.clearCookie(CSRF_TOKEN_COOKIE, { path: "/" });
    return { success: true };
  }

  private setSessionCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions(ACCESS_TOKEN_TTL_MS, true));
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS, true));
    // Non-httpOnly by design — the frontend reads this to echo it back in X-CSRF-Token.
    res.cookie(CSRF_TOKEN_COOKIE, randomBytes(24).toString("hex"), cookieOptions(REFRESH_TOKEN_TTL_MS, false));
  }
}

interface SessionUser {
  id: string;
  email: string;
  fullName: string;
}
