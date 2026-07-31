const TRANSIENT_PRISMA_CONNECTION_CODES: ReadonlySet<string> = new Set(["P1001", "P1002", "P1017"]);

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { code?: unknown; errorCode?: unknown };
  if (typeof candidate.code === "string") return candidate.code;
  return typeof candidate.errorCode === "string" ? candidate.errorCode : undefined;
}

export function isTransientPrismaConnectionError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code !== undefined && TRANSIENT_PRISMA_CONNECTION_CODES.has(code);
}

/** Export report reads are side-effect free, so one retry is safe when Prisma reports a
 * transient connection/startup failure. Persistent and non-connectivity errors still
 * propagate immediately and are recorded on the export job as FAILED. */
export async function retryTransientPrismaRead<T>(operation: () => Promise<T>, delayMs = 100): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientPrismaConnectionError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return operation();
  }
}
