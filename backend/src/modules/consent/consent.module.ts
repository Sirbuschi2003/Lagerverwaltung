import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConsentController } from "./consent.controller";
import { ConsentService } from "./consent.service";
import { UserConsent } from "./entities/user-consent.entity";

@Module({
  imports: [TypeOrmModule.forFeature([UserConsent])],
  controllers: [ConsentController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
