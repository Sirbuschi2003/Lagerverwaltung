import { Module } from "@nestjs/common";
import { DatabaseFixService } from "./database-fix.service";

@Module({
  providers: [DatabaseFixService],
  exports: [DatabaseFixService],
})
export class DatabaseModule {}
