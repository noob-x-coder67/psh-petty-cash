import { describe, expect, it } from "vitest";
import { isPettyCashEnableAllowed } from "./organization.rules";

describe("isPettyCashEnableAllowed (BR-016, R-11)", () => {
  it("rejects enabling petty cash for PSH-ISB", () => {
    expect(isPettyCashEnableAllowed("PSH-ISB", true)).toBe(false);
  });

  it("allows disabling petty cash for PSH-ISB (a no-op, but not a rejected one)", () => {
    expect(isPettyCashEnableAllowed("PSH-ISB", false)).toBe(true);
  });

  it("allows enabling petty cash for any other unit", () => {
    expect(isPettyCashEnableAllowed("PSH-SOH", true)).toBe(true);
  });

  it("allows disabling petty cash for any other unit", () => {
    expect(isPettyCashEnableAllowed("PSH-SOH", false)).toBe(true);
  });
});
