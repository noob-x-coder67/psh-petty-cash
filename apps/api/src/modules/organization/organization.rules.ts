// Pure decision logic — no I/O — so every branch is testable without a database.

// BR-016/R-11: PSH-ISB may never have petty cash enabled. ck_psh_isb_never_enabled
// (the CHECK constraint) is the ultimate DB-level backstop; this is defense in depth,
// catching the mistake at the API layer before it ever reaches the database — the same
// "never weaken any layer" reasoning already applied everywhere else this rule appears.
export function isPettyCashEnableAllowed(code: string, pettyCashEnabled: boolean): boolean {
  return !(code === "PSH-ISB" && pettyCashEnabled);
}
