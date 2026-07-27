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

  return <AppShell user={user}>{children}</AppShell>;
}
