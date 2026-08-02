import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module";
import { CategoriesModule } from "../categories/categories.module";
import { MonthCloseModule } from "../month-close/month-close.module";
import { ExpensesController } from "./expenses.controller";
import { ExpensesRepository } from "./expenses.repository";
import { ExpensesService } from "./expenses.service";

@Module({
  imports: [AccountsModule, CategoriesModule, MonthCloseModule],
  controllers: [ExpensesController],
  providers: [ExpensesRepository, ExpensesService],
})
export class ExpensesModule {}
