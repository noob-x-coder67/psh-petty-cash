import argon2 from "argon2";

// Build Plan §6.1 minimum: m=19456,t=2,p=1.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // argon2.verify throws on a malformed/foreign hash (e.g. the seed placeholder
    // string) rather than returning false — treat that the same as a mismatch.
    return false;
  }
}
