import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

const originalAuthSecret = process.env.AUTH_SECRET;

afterEach(() => {
  if (originalAuthSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = originalAuthSecret;
  }
});

describe("CommonModule AUTH_SECRET configuration", () => {
  it("can be imported for static reflection without AUTH_SECRET", async () => {
    delete process.env.AUTH_SECRET;

    await expect(import("./common.module.js")).resolves.toHaveProperty("CommonModule");
  });

  it("fails fast when a real Nest testing module is instantiated without AUTH_SECRET", async () => {
    delete process.env.AUTH_SECRET;
    const { CommonModule } = await import("./common.module.js");

    await expect(Test.createTestingModule({ imports: [CommonModule] }).compile()).rejects.toThrow(
      "AUTH_SECRET is not set — refusing to start with an undefined JWT signing secret.",
    );
  });
});
