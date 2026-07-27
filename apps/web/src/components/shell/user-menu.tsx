"use client";

import type { AuthenticatedUser } from "@psh/contracts";
import { Button } from "@psh/ui";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "../../lib/api-client";

export function UserMenu({ user }: { user: AuthenticatedUser }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2 border-l border-border pl-2">
      <span className="text-sm text-ink">{user.fullName}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void handleLogout()}
        disabled={loggingOut}
        aria-label="Log out"
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
