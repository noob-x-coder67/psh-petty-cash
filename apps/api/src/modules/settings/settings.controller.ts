import { Controller, Get } from "@nestjs/common";
import type { AdminSettingsResponse } from "@psh/contracts";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { SettingsService } from "./settings.service";

// admin.manage_users_units (Super Admin only) — SRS §6.1 lists "technical configuration"
// only under Super Admin's responsibilities, matching the same permission unit
// management uses. Read-only: no PATCH route exists (see settings.service.ts).
@Controller("admin/settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequiresPermission("admin.manage_users_units")
  getSettings(): AdminSettingsResponse {
    return this.settingsService.getSettings();
  }
}
