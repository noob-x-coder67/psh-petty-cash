import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module";
import { AllocationsController } from "./allocations.controller";
import { AllocationsRepository } from "./allocations.repository";
import { AllocationsService } from "./allocations.service";

@Module({
  imports: [AccountsModule],
  controllers: [AllocationsController],
  providers: [AllocationsRepository, AllocationsService],
})
export class AllocationsModule {}
