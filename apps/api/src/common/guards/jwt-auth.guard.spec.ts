import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import type { AuthContextRepository } from "../auth/auth-context.repository";
import type { AuthenticatedUser } from "../types/authenticated-user";
import { JwtAuthGuard } from "./jwt-auth.guard";

function makeContext(cookies: Record<string, string> = {}): ExecutionContext & { request: Record<string, unknown> } {
  const request: Record<string, unknown> = { cookies };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext & { request: Record<string, unknown> };
  context.request = request;
  return context;
}

function makeReflector(isPublic?: boolean): Reflector {
  return { getAllAndOverride: vi.fn(() => isPublic) } as unknown as Reflector;
}

const contextUser: AuthenticatedUser = {
  id: "u1",
  email: "a@psh.local",
  fullName: "A",
  mustChangePassword: false,
  roleKeys: [],
  permissionKeys: [],
  unitScope: { all: false, unitIds: [] },
};

describe("JwtAuthGuard", () => {
  it("allows public routes without checking a token", async () => {
    const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
    const authContextRepository = { loadById: vi.fn() } as unknown as AuthContextRepository;
    const guard = new JwtAuthGuard(makeReflector(true), jwtService, authContextRepository);
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it("throws when no access token cookie is present", async () => {
    const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
    const authContextRepository = { loadById: vi.fn() } as unknown as AuthContextRepository;
    const guard = new JwtAuthGuard(makeReflector(false), jwtService, authContextRepository);
    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it("throws when the token fails verification", async () => {
    const jwtService = { verifyAsync: vi.fn().mockRejectedValue(new Error("bad token")) } as unknown as JwtService;
    const authContextRepository = { loadById: vi.fn() } as unknown as AuthContextRepository;
    const guard = new JwtAuthGuard(makeReflector(false), jwtService, authContextRepository);
    await expect(guard.canActivate(makeContext({ psh_access_token: "x" }))).rejects.toThrow(UnauthorizedException);
  });

  it("throws when the user no longer exists", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue({ sub: "u1" }) } as unknown as JwtService;
    const authContextRepository = {
      loadById: vi.fn().mockResolvedValue({ found: false }),
    } as unknown as AuthContextRepository;
    const guard = new JwtAuthGuard(makeReflector(false), jwtService, authContextRepository);
    await expect(guard.canActivate(makeContext({ psh_access_token: "x" }))).rejects.toThrow(UnauthorizedException);
  });

  it("throws when the account is inactive", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue({ sub: "u1" }) } as unknown as JwtService;
    const authContextRepository = {
      loadById: vi.fn().mockResolvedValue({ found: true, isActive: false, lockedUntil: null, context: contextUser }),
    } as unknown as AuthContextRepository;
    const guard = new JwtAuthGuard(makeReflector(false), jwtService, authContextRepository);
    await expect(guard.canActivate(makeContext({ psh_access_token: "x" }))).rejects.toThrow(UnauthorizedException);
  });

  it("throws when the account is locked", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue({ sub: "u1" }) } as unknown as JwtService;
    const authContextRepository = {
      loadById: vi.fn().mockResolvedValue({
        found: true,
        isActive: true,
        lockedUntil: new Date(Date.now() + 60_000),
        context: contextUser,
      }),
    } as unknown as AuthContextRepository;
    const guard = new JwtAuthGuard(makeReflector(false), jwtService, authContextRepository);
    await expect(guard.canActivate(makeContext({ psh_access_token: "x" }))).rejects.toThrow(UnauthorizedException);
  });

  it("attaches the user to the request and allows when everything checks out", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue({ sub: "u1" }) } as unknown as JwtService;
    const authContextRepository = {
      loadById: vi.fn().mockResolvedValue({ found: true, isActive: true, lockedUntil: null, context: contextUser }),
    } as unknown as AuthContextRepository;
    const guard = new JwtAuthGuard(makeReflector(false), jwtService, authContextRepository);
    const context = makeContext({ psh_access_token: "x" });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.request.user).toBe(contextUser);
  });

  it("allows when locked_until is in the past", async () => {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue({ sub: "u1" }) } as unknown as JwtService;
    const authContextRepository = {
      loadById: vi.fn().mockResolvedValue({
        found: true,
        isActive: true,
        lockedUntil: new Date(Date.now() - 60_000),
        context: contextUser,
      }),
    } as unknown as AuthContextRepository;
    const guard = new JwtAuthGuard(makeReflector(false), jwtService, authContextRepository);
    await expect(guard.canActivate(makeContext({ psh_access_token: "x" }))).resolves.toBe(true);
  });
});
