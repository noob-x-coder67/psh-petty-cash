import type { AuthenticatedUser, ExpenseCategory } from "@psh/contracts";
import { redirect } from "next/navigation";
import { CategoriesWorkspace } from "../../../../components/admin/categories-workspace";
import { serverApiFetch } from "../../../../lib/server-api-client";

export default async function AdminCategoriesPage() {
  const me = await serverApiFetch<AuthenticatedUser>("/me");
  if (!me.permissionKeys.includes("category.manage")) {
    redirect(me.unitScope.all ? "/overview" : "/my-unit");
  }

  // The API permission gate remains authoritative. This fetch will independently
  // return 403 if category.manage is missing or changes between the two requests.
  const categories = await serverApiFetch<ExpenseCategory[]>("/admin/categories");
  return <CategoriesWorkspace initialCategories={categories} />;
}
