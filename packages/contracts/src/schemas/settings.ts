import { z } from "zod";

// Read-only snapshot of the currently-effective deployment configuration (.env-driven —
// no settings table exists yet, see the Administration plan's deferred "editable
// settings" decision). `enforced: false` marks a value that's configured but not
// actually consumed by any code path yet, so this screen never implies a control exists
// before it's actually built.
export const AdminSettingSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  enforced: z.boolean(),
  note: z.string().optional(),
});
export type AdminSetting = z.infer<typeof AdminSettingSchema>;

export const AdminSettingsResponseSchema = z.object({
  settings: z.array(AdminSettingSchema),
});
export type AdminSettingsResponse = z.infer<typeof AdminSettingsResponseSchema>;
