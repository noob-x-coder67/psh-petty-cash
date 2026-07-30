import type { AuthenticatedUser } from "@psh/contracts";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "../../components/shell/app-shell";
import { serverApiFetch } from "../../lib/server-api-client";

export default async function AppLayout({ children }: { children: ReactNode }) {
  let user: AuthenticatedUser;
  try {
    user = await serverApiFetch<AuthenticatedUser>("/me");
  } catch {
    redirect("/login");
  }

  // Server-side, not just a post-login client redirect (rule 19) — /change-password
  // itself lives outside this (app) route group (same reason /login does), so this
  // check never loops: once there, mustChangePassword clearing is what lets a later
  // visit back into (app) through.
  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
