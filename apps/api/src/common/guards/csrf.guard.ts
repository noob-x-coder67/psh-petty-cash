import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const CSRF_TOKEN_COOKIE = "psh_csrf_token";
const CSRF_HEADER = "x-csrf-token";

/** Double-submit CSRF check for cookie-authenticated state-changing routes (Build Plan §6.2/§6.5). */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieToken = (request.cookies as Record<string, string> | undefined)?.[CSRF_TOKEN_COOKIE];
    const headerToken = request.headers[CSRF_HEADER];
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException("Missing or invalid CSRF token");
    }
    return true;
  }
}
