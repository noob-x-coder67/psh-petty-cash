import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { MeController } from "./me.controller";

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthRepository, AuthService],
})
export class AuthModule {}
