import { SetMetadata, type CustomDecorator } from "@nestjs/common";

export const REQUIRES_PERMISSION_KEY = "requiresPermission";

/** Restricts a route to users whose resolved role_permissions include this key (Appendix A). */
export const RequiresPermission = (permissionKey: string): CustomDecorator<string> =>
  SetMetadata(REQUIRES_PERMISSION_KEY, permissionKey);
