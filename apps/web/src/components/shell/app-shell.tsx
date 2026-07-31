"use client";

import type { AuthenticatedUser } from "@psh/contracts";
import type { ReactNode } from "react";
import { useState } from "react";
import { useCommandPaletteShortcut } from "../../lib/use-command-palette-shortcut";
import { CommandPalette } from "./command-palette";
import { Masthead } from "./masthead";
import { MobileDock } from "./mobile-dock";
import { WorkspaceTabs } from "./workspace-tabs";

export function AppShell({ user, children }: { user: AuthenticatedUser; children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(() => setPaletteOpen(true));
  const canCreateExpense = user.permissionKeys.includes("expense.create");

  return (
    <div className="flex min-h-screen flex-col">
      <Masthead user={user} onOpenCommandPalette={() => setPaletteOpen(true)} />
      <WorkspaceTabs user={user} />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <MobileDock canCreateExpense={canCreateExpense} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} canCreateExpense={canCreateExpense} />
    </div>
  );
}
