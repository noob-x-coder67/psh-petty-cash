import { redirect } from "next/navigation";
import type { AuthenticatedUser } from "@psh/contracts";
import { serverApiFetch } from "../lib/server-api-client";

// Build Plan §4.3 landing-by-role table: Super Admin/Finance Manager/Finance
// Officer/Auditor -> /overview; Unit User/Unit In-Charge -> /my-unit. unitScope.all is
// exactly the same partition the API itself already computes (auth-context.repository.ts
// ALL_UNIT_SCOPE_ROLES), so this reuses it rather than re-deriving the role list.
export default async function Home() {
  let user: AuthenticatedUser;
  try {
    user = await serverApiFetch<AuthenticatedUser>("/me");
  } catch {
    redirect("/login");
  }
  redirect(user.unitScope.all ? "/overview" : "/my-unit");
}
