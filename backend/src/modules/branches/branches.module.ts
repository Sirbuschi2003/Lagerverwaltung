import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AccessControlModule } from "../access-control/access-control.module";

import { BranchesController } from "./branches.controller";
import { BranchesService } from "./branches.service";
import { Branch } from "./entities/branch.entity";


@Module({
  imports: [TypeOrmModule.forFeature([Branch]), AccessControlModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
