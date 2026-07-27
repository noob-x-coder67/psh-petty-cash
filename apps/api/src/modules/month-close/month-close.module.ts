import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module";
import { MonthCloseController } from "./month-close.controller";
import { MonthCloseRepository } from "./month-close.repository";
import { MonthCloseService } from "./month-close.service";
import { ReplenishmentsController } from "./replenishments.controller";
import { ReplenishmentsRepository } from "./replenishments.repository";
import { ReplenishmentsService } from "./replenishments.service";

@Module({
  imports: [AccountsModule],
  controllers: [MonthCloseController, ReplenishmentsController],
  providers: [MonthCloseRepository, MonthCloseService, ReplenishmentsRepository, ReplenishmentsService],
  exports: [MonthCloseRepository],
})
export class MonthCloseModule {}
