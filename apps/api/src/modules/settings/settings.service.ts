import { Injectable } from "@nestjs/common";
import type { AdminSetting, AdminSettingsResponse } from "@psh/contracts";
import { DEFAULT_THROTTLE_LIMIT, DEFAULT_THROTTLE_TTL_MS } from "../../common/common.module";
import { UPLOAD_MAX_BYTES } from "../attachments/attachments.service";

// Read-only snapshot of the currently-effective deployment configuration — no PATCH,
// no settings table (Administration plan's confirmed "read-only for now" scope: an
// editable, audited settings table is real future work, not built here). Values are
// read from the same env vars / exported constants the rest of the app actually uses —
// never re-parsed or duplicated, so this screen can't silently drift from reality.
@Injectable()
export class SettingsService {
  getSettings(): AdminSettingsResponse {
    const settings: AdminSetting[] = [
      {
        key: "ATTACHMENT_STORAGE_DRIVER",
        label: "Attachment storage driver",
        // Same string test as storage.module.ts's factory — deliberately not importing
        // the driver classes themselves (rule 18: no driver referenced by name outside
        // apps/api/src/storage/**), just re-deriving which of the two selectable string
        // values is currently active.
        value: process.env.ATTACHMENT_STORAGE_DRIVER === "filesystem" ? "filesystem" : "postgres-bytea",
        enforced: true,
      },
      {
        key: "UPLOAD_MAX_BYTES",
        label: "Max attachment upload size",
        value: `${UPLOAD_MAX_BYTES} bytes (${(UPLOAD_MAX_BYTES / (1024 * 1024)).toFixed(2)} MB)`,
        enforced: true,
      },
      {
        key: "UPLOAD_RETENTION_DAYS",
        label: "Upload retention (days)",
        value: String(Number(process.env.UPLOAD_RETENTION_DAYS ?? 30)),
        enforced: false,
        note: "Configured, not yet enforced — the archival/retention job (BR-014, BR-015) isn't implemented.",
      },
      {
        key: "ARCHIVE_GRACE_DAYS",
        label: "Archive grace period (days)",
        value: String(Number(process.env.ARCHIVE_GRACE_DAYS ?? 7)),
        enforced: false,
        note: "Configured, not yet enforced — the archival/retention job (BR-014, BR-015) isn't implemented.",
      },
      {
        key: "THROTTLE_DEFAULT",
        label: "Default rate limit",
        value: `${DEFAULT_THROTTLE_LIMIT} requests / ${DEFAULT_THROTTLE_TTL_MS / 1000}s`,
        enforced: true,
        note: "/auth/login uses a stricter dedicated bucket, not shown here.",
      },
    ];

    return { settings };
  }
}
