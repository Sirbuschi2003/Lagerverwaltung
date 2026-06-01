import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DeliveryNote } from "./entities/delivery-note.entity";
import { Branch } from "../branches/entities/branch.entity";
import { DeliveryNotesService } from "./delivery-notes.service";
import { DeliveryNotesController } from "./delivery-notes.controller";

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryNote, Branch])],
  controllers: [DeliveryNotesController],
  providers: [DeliveryNotesService],
  exports: [DeliveryNotesService],
})
export class DeliveryNotesModule {}
