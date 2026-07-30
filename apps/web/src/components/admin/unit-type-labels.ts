import type { UnitType } from "@psh/contracts";

// Mirrors prisma/schema.prisma's UnitType enum values — same duplication reasoning as
// role-labels.ts (apps/web can't import from prisma/ or apps/api).
export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  HEAD_OFFICE: "Head Office",
  CENTER: "Center",
  PROJECT: "Project",
  PROJECT_LOCATION: "Project Location",
  SERVICE: "Service",
};

export const UNIT_TYPE_OPTIONS: UnitType[] = ["HEAD_OFFICE", "CENTER", "PROJECT", "PROJECT_LOCATION", "SERVICE"];
