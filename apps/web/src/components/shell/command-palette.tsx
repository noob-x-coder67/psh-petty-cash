"use client";

import { Dialog, DialogContent, DialogTitle } from "@psh/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface Command {
  label: string;
  href: string;
}

// SRS §11.2/§12.6: no literal command list is specified anywhere in the SRS/Build Plan —
// this is a reasonable default (navigation jumps + the single most common action) rather
// than a prescribed requirement.
const COMMANDS: Command[] = [
  { label: "New Expense", href: "/expenses/new" },
  { label: "Overview", href: "/overview" },
  { label: "My Unit", href: "/my-unit" },
  { label: "Cash Flow", href: "/cash-flow" },
  { label: "Expense Register", href: "/expenses" },
  { label: "Reports Studio", href: "/reports" },
  { label: "Month Close", href: "/month-close" },
];

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => COMMANDS.filter((command) => command.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function go(href: string): void {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent open={open} className="max-w-md p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to..."
          className="psh-focus-ring w-full border-b border-border bg-transparent px-4 py-3 text-sm text-ink outline-none"
          aria-label="Search commands"
        />
        <ul className="max-h-80 overflow-y-auto py-2">
          {filtered.map((command) => (
            <li key={command.href}>
              <button
                type="button"
                onClick={() => go(command.href)}
                className="psh-focus-ring w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface-0"
              >
                {command.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li className="px-4 py-2 text-sm text-ink-muted">No matches</li> : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
