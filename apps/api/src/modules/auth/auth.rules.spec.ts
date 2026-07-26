import { describe, expect, it } from "vitest";
import { computeLockoutUntil, evaluateLogin, evaluateRefresh, LOCKOUT_THRESHOLD } from "./auth.rules";

const NOW = new Date("2026-07-26T12:00:00.000Z");

describe("computeLockoutUntil", () => {
  it("returns null below the threshold", () => {
    expect(computeLockoutUntil(LOCKOUT_THRESHOLD - 1, NOW)).toBeNull();
  });

  it("returns a 5-minute lockout at the threshold", () => {
    const result = computeLockoutUntil(LOCKOUT_THRESHOLD, NOW);
    expect(result).toEqual(new Date(NOW.getTime() + 5 * 60_000));
  });

  it("doubles the backoff for each failure past the threshold", () => {
    expect(computeLockoutUntil(LOCKOUT_THRESHOLD + 1, NOW)).toEqual(new Date(NOW.getTime() + 10 * 60_000));
    expect(computeLockoutUntil(LOCKOUT_THRESHOLD + 2, NOW)).toEqual(new Date(NOW.getTime() + 20 * 60_000));
  });
});

describe("evaluateLogin", () => {
  it("rejects an inactive account regardless of other state", () => {
    const result = evaluateLogin({
      isActive: false,
      lockedUntil: null,
      failedLoginCount: 0,
      passwordMatches: true,
      now: NOW,
    });
    expect(result).toEqual({ outcome: "ACCOUNT_INACTIVE" });
  });

  it("rejects when locked_until is in the future", () => {
    const lockedUntil = new Date(NOW.getTime() + 60_000);
    const result = evaluateLogin({
      isActive: true,
      lockedUntil,
      failedLoginCount: LOCKOUT_THRESHOLD,
      passwordMatches: true,
      now: NOW,
    });
    expect(result).toEqual({ outcome: "LOCKED", lockedUntil });
  });

  it("falls through to a normal check when locked_until is in the past", () => {
    const lockedUntil = new Date(NOW.getTime() - 60_000);
    const result = evaluateLogin({
      isActive: true,
      lockedUntil,
      failedLoginCount: LOCKOUT_THRESHOLD,
      passwordMatches: true,
      now: NOW,
    });
    expect(result).toEqual({ outcome: "SUCCESS" });
  });

  it("increments failedLoginCount and computes lockout on a wrong password", () => {
    const result = evaluateLogin({
      isActive: true,
      lockedUntil: null,
      failedLoginCount: LOCKOUT_THRESHOLD - 1,
      passwordMatches: false,
      now: NOW,
    });
    expect(result).toEqual({
      outcome: "INVALID_CREDENTIALS",
      nextFailedLoginCount: LOCKOUT_THRESHOLD,
      nextLockedUntil: new Date(NOW.getTime() + 5 * 60_000),
    });
  });

  it("increments failedLoginCount without a lockout when still below threshold", () => {
    const result = evaluateLogin({
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0,
      passwordMatches: false,
      now: NOW,
    });
    expect(result).toEqual({
      outcome: "INVALID_CREDENTIALS",
      nextFailedLoginCount: 1,
      nextLockedUntil: null,
    });
  });

  it("succeeds and reports SUCCESS with no lock and correct password", () => {
    const result = evaluateLogin({
      isActive: true,
      lockedUntil: null,
      failedLoginCount: 0,
      passwordMatches: true,
      now: NOW,
    });
    expect(result).toEqual({ outcome: "SUCCESS" });
  });
});

describe("evaluateRefresh", () => {
  it("detects reuse when the session was already revoked", () => {
    const result = evaluateRefresh({
      revokedAt: new Date(NOW.getTime() - 1000),
      expiresAt: new Date(NOW.getTime() + 60_000),
      now: NOW,
    });
    expect(result).toBe("REUSE_DETECTED");
  });

  it("detects expiry when past expiresAt", () => {
    const result = evaluateRefresh({
      revokedAt: null,
      expiresAt: new Date(NOW.getTime() - 1000),
      now: NOW,
    });
    expect(result).toBe("EXPIRED");
  });

  it("treats expiresAt exactly equal to now as expired", () => {
    const result = evaluateRefresh({ revokedAt: null, expiresAt: NOW, now: NOW });
    expect(result).toBe("EXPIRED");
  });

  it("is valid when not revoked and not yet expired", () => {
    const result = evaluateRefresh({
      revokedAt: null,
      expiresAt: new Date(NOW.getTime() + 60_000),
      now: NOW,
    });
    expect(result).toBe("VALID");
  });
});
