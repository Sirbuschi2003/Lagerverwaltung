import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserConsent } from "./entities/user-consent.entity";
import { ConsentService } from "./consent.service";
import { ConsentController } from "./consent.controller";

@Module({
  imports: [TypeOrmModule.forFeature([UserConsent])],
  controllers: [ConsentController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
