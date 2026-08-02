export type AdministrationModuleKey = "users" | "units" | "permissions" | "configuration" | "categories";

export interface AdministrationModule {
  key: AdministrationModuleKey;
  label: string;
  description: string;
  href: string;
  requiredPermission: string;
}

export const ADMINISTRATION_MODULES: AdministrationModule[] = [
  {
    key: "users",
    label: "Users",
    description: "Accounts, roles and access assignment",
    href: "/admin/users",
    requiredPermission: "admin.manage_unit_access",
  },
  {
    key: "units",
    label: "Units",
    description: "Petty-cash unit registry and metadata",
    href: "/admin/units",
    requiredPermission: "admin.manage_users_units",
  },
  {
    key: "permissions",
    label: "Permissions",
    description: "Role-to-permission mapping",
    href: "/admin/roles",
    requiredPermission: "admin.manage_unit_access",
  },
  {
    key: "configuration",
    label: "Configuration",
    description: "System-wide settings",
    href: "/admin/settings",
    requiredPermission: "admin.manage_users_units",
  },
  {
    key: "categories",
    label: "Categories",
    description: "Expense categories, availability and display order",
    href: "/admin/categories",
    requiredPermission: "category.manage",
  },
];

export function visibleAdministrationModules(permissionKeys: readonly string[]): AdministrationModule[] {
  const permissions = new Set(permissionKeys);
  return ADMINISTRATION_MODULES.filter((module) => permissions.has(module.requiredPermission));
}

export function canAccessAdministration(permissionKeys: readonly string[]): boolean {
  return visibleAdministrationModules(permissionKeys).length > 0;
}
