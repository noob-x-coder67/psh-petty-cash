// Pure decision logic — no I/O, no Prisma, no Date.now() calls internally (caller
// supplies `now`) — so every branch is testable without a database. FR-AUTH-005.

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_BASE_MINUTES = 5;

/**
 * Exponential backoff starting once failedLoginCount reaches the threshold:
 * 5th failure -> 5min, 6th -> 10min, 7th -> 20min, etc.
 */
export function computeLockoutUntil(failedLoginCount: number, now: Date): Date | null {
  if (failedLoginCount < LOCKOUT_THRESHOLD) {
    return null;
  }
  const stepsPastThreshold = failedLoginCount - LOCKOUT_THRESHOLD;
  const minutes = LOCKOUT_BASE_MINUTES * 2 ** stepsPastThreshold;
  return new Date(now.getTime() + minutes * 60_000);
}

export type LoginDecision =
  | { outcome: "ACCOUNT_INACTIVE" }
  | { outcome: "LOCKED"; lockedUntil: Date }
  | { outcome: "INVALID_CREDENTIALS"; nextFailedLoginCount: number; nextLockedUntil: Date | null }
  | { outcome: "SUCCESS" };

export function evaluateLogin(params: {
  isActive: boolean;
  lockedUntil: Date | null;
  failedLoginCount: number;
  passwordMatches: boolean;
  now: Date;
}): LoginDecision {
  if (!params.isActive) {
    return { outcome: "ACCOUNT_INACTIVE" };
  }
  if (params.lockedUntil !== null && params.lockedUntil > params.now) {
    return { outcome: "LOCKED", lockedUntil: params.lockedUntil };
  }
  if (!params.passwordMatches) {
    const nextFailedLoginCount = params.failedLoginCount + 1;
    return {
      outcome: "INVALID_CREDENTIALS",
      nextFailedLoginCount,
      nextLockedUntil: computeLockoutUntil(nextFailedLoginCount, params.now),
    };
  }
  return { outcome: "SUCCESS" };
}

export type RefreshDecision = "REUSE_DETECTED" | "EXPIRED" | "VALID";

/** Reused (already-rotated) refresh tokens revoke the whole session family — §6.1. */
export function evaluateRefresh(params: { revokedAt: Date | null; expiresAt: Date; now: Date }): RefreshDecision {
  if (params.revokedAt !== null) {
    return "REUSE_DETECTED";
  }
  if (params.expiresAt <= params.now) {
    return "EXPIRED";
  }
  return "VALID";
}
