import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";

// Build Plan §15.3 lists `GET /me` as its own top-level route, separate from /auth/*.
@Controller()
export class MeController {
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
