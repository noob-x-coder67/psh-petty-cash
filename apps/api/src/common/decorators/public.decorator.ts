import { SetMetadata, type CustomDecorator } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route as exempt from JwtAuthGuard (login, refresh, health). */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
