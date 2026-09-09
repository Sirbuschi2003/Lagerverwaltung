import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import { LocationType } from "../entities/location.entity";

const CREATABLE_TYPES: LocationType[] = ["WAREHOUSE", "SHELF", "BIN"];

export class CreateLocationDto {
  @IsIn(CREATABLE_TYPES)
  type!: LocationType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
