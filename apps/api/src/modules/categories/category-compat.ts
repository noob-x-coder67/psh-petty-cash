// Transitional bridge only: Phase 2 changes the database/Prisma representation before
// Phases 3-4 change the public expense/report contracts. It keeps those existing callers
// buildable against the approved Option 1 mappings and is deleted once they carry UUIDs.
export type LegacyExpenseCategory = "BUILDING" | "VEHICLE" | "OTHER";

export const LEGACY_CATEGORY_NAME: Record<LegacyExpenseCategory, string> = {
  BUILDING: "Repair & Maintenance: Building",
  VEHICLE: "Repair & Maintenance: Vehicle",
  OTHER: "Miscellaneous",
};

export function legacyCategoryFromName(name: string): LegacyExpenseCategory {
  switch (name) {
    case "Repair & Maintenance: Building":
      return "BUILDING";
    case "Repair & Maintenance: Vehicle":
      return "VEHICLE";
    case "Miscellaneous":
      return "OTHER";
    default:
      throw new Error(`Category ${name} is not representable by the transitional legacy contract`);
  }
}
