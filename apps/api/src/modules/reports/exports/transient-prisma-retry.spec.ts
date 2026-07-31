import { describe, expect, it, vi } from "vitest";
import { isTransientPrismaConnectionError, retryTransientPrismaRead } from "./transient-prisma-retry.js";

describe("retryTransientPrismaRead", () => {
  it("retries one transient Prisma connectivity failure", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(Object.assign(new Error("database unavailable"), { errorCode: "P1001" }))
      .mockResolvedValue("ready");

    await expect(retryTransientPrismaRead(operation, 0)).resolves.toBe("ready");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-connectivity failures", async () => {
    const error = Object.assign(new Error("unique constraint"), { code: "P2002" });
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(retryTransientPrismaRead(operation, 0)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("propagates a second transient failure after the single retry", async () => {
    const error = Object.assign(new Error("still unavailable"), { errorCode: "P1001" });
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(retryTransientPrismaRead(operation, 0)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe("isTransientPrismaConnectionError", () => {
  it.each(["P1001", "P1002", "P1017"])("recognizes %s", (code) => {
    expect(isTransientPrismaConnectionError({ code })).toBe(true);
  });
});
