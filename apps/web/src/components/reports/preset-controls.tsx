"use client";

import type { ReportFilter, ReportKey } from "@psh/contracts";
import { Button, Input } from "@psh/ui";
import { useState } from "react";
import { usePresets } from "./use-presets";

// SRS §12.8: save the current filter set as a named preset, or load one back.
export function PresetControls({
  reportKey,
  filter,
  onApply,
}: {
  reportKey: ReportKey;
  filter: ReportFilter;
  onApply: (filter: ReportFilter) => void;
}) {
  const { presets, createPreset, isCreating, createError, deletePreset } = usePresets(reportKey);
  const [selectedId, setSelectedId] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [name, setName] = useState("");

  function handleApply(id: string): void {
    setSelectedId(id);
    const preset = presets.find((candidate) => candidate.id === id);
    if (preset) onApply(preset.filters);
  }

  function handleSave(): void {
    if (!name.trim()) return;
    createPreset({ reportKey, name: name.trim(), filters: filter });
    setName("");
    setShowSaveInput(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Load saved preset"
        className="psh-focus-ring h-10 rounded-control border border-border bg-surface-1 px-2 text-sm text-ink"
        value={selectedId}
        onChange={(event) => handleApply(event.target.value)}
      >
        <option value="">Saved filters...</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>

      {selectedId ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            deletePreset(selectedId);
            setSelectedId("");
          }}
        >
          Delete preset
        </Button>
      ) : null}

      {showSaveInput ? (
        <>
          <Input
            aria-label="Preset name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Preset name"
            className="w-40"
          />
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={isCreating || !name.trim()}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSaveInput(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setShowSaveInput(true)}>
          Save current filters
        </Button>
      )}

      {createError ? (
        <span className="text-sm text-coral-500">
          {createError instanceof Error ? createError.message : "Could not save preset."}
        </span>
      ) : null}
    </div>
  );
}
