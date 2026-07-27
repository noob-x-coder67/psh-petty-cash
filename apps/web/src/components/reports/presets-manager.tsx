"use client";

import { Badge, Button, Card, CardContent } from "@psh/ui";
import Link from "next/link";
import { usePresets } from "./use-presets";

// SRS §12.8 management view: every saved preset the current user owns, across every
// report, with a link back to the report itself (the inline dropdown on that page is
// what actually re-applies the filters — see PresetControls).
export function PresetsManager() {
  const { presets, isLoading, deletePreset } = usePresets();

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Saved Report Filters</h1>
        <p className="mt-1 text-sm text-ink-muted">Presets you've saved across every report.</p>
      </div>

      {isLoading ? <p className="text-sm text-ink-muted">Loading...</p> : null}

      {!isLoading && presets.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No saved presets yet — open a report and use "Save current filters" to create one.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {presets.map((preset) => (
          <Card key={preset.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{preset.reportKey}</Badge>
                  <p className="font-medium text-ink">{preset.name}</p>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  Saved {new Date(preset.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/reports/${preset.reportKey}`}>
                  <Button variant="secondary" size="sm">
                    Open report
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => deletePreset(preset.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
