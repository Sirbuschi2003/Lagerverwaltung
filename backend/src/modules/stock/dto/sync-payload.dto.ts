import { Type } from "class-transformer";
import { ValidateNested, IsArray } from "class-validator";

import { RecordMovementDto } from "./record-movement.dto";

export class SyncPayloadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordMovementDto)
  movements!: RecordMovementDto[];
}

