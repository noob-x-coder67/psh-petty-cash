import type { AuthenticatedUser } from "@psh/contracts";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "../../components/auth/change-password-form";
import { serverApiFetch } from "../../lib/server-api-client";

// Outside the (app) route group, same reason /login is — (app)/layout.tsx redirects
// here whenever mustChangePassword is true, so this page can't itself live inside that
// same redirect loop.
export default async function ChangePasswordPage() {
  let user: AuthenticatedUser;
  try {
    user = await serverApiFetch<AuthenticatedUser>("/me");
  } catch {
    redirect("/login");
  }

  return <ChangePasswordForm fullName={user.fullName} />;
}
