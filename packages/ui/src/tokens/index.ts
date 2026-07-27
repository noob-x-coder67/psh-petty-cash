// Aurora Ledger design tokens (SRS §11.3/11.4). tokens.css is the Tailwind-consumable
// half (colors/radii/shadows/font as @theme entries, imported once by apps/web's
// globals.css); this file is the JS-side half for consumers that need raw values —
// Recharts series colors and Motion transition durations, neither of which reads CSS
// custom properties.

export const colors = {
  midnight950: "hsl(222 47% 6%)",
  midnight900: "hsl(222 44% 11%)",
  midnight700: "hsl(222 35% 24%)",
  royal600: "hsl(226 83% 53%)",
  royal500: "hsl(226 83% 60%)",
  royal100: "hsl(226 90% 96%)",
  cyan500: "hsl(189 85% 42%)",
  emerald500: "hsl(152 60% 38%)",
  amber500: "hsl(38 92% 48%)",
  amber100: "hsl(38 92% 94%)",
  coral500: "hsl(6 78% 56%)",
  coral100: "hsl(6 90% 95%)",
  violet500: "hsl(262 60% 56%)",
  violet100: "hsl(262 65% 96%)",
  surface0: "hsl(220 25% 99%)",
  surface1: "hsl(0 0% 100%)",
  border: "hsl(220 16% 89%)",
  borderStrong: "hsl(220 16% 78%)",
  ink: "hsl(222 47% 11%)",
  inkMuted: "hsl(220 9% 42%)",
} as const;

// SRS §13.2: "Primary transitions: 180-320ms; large workspace transitions: 350-550ms."
// Values in seconds, matching Motion's transition API.
export const motionDuration = {
  fast: 0.18,
  base: 0.26,
  slow: 0.42,
} as const;

export const radius = {
  control: "0.625rem",
  card: "1rem",
  feature: "1.5rem",
} as const;
