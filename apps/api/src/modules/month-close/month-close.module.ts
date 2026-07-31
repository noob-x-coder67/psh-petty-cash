import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module";
import { MonthCloseController } from "./month-close.controller";
import { MonthCloseRepository } from "./month-close.repository";
import { MonthCloseService } from "./month-close.service";
import { ReplenishmentRequestsController } from "./replenishment-requests.controller";
import { ReplenishmentRequestsRepository } from "./replenishment-requests.repository";
import { ReplenishmentRequestsService } from "./replenishment-requests.service";
import { ReplenishmentsController } from "./replenishments.controller";
import { ReplenishmentsRepository } from "./replenishments.repository";
import { ReplenishmentsService } from "./replenishments.service";

@Module({
  imports: [AccountsModule],
  controllers: [MonthCloseController, ReplenishmentsController, ReplenishmentRequestsController],
  providers: [
    MonthCloseRepository,
    MonthCloseService,
    ReplenishmentsRepository,
    ReplenishmentsService,
    ReplenishmentRequestsRepository,
    ReplenishmentRequestsService,
  ],
  exports: [MonthCloseRepository],
})
export class MonthCloseModule {}
