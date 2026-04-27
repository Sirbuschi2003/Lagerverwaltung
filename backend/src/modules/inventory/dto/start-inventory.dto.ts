import { IsArray, IsDateString, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class StartInventoryDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(120)
  createdBy!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string | null;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("all", { each: true })
  assignedUserIds?: string[];
}

