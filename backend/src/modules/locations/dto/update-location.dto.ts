import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateLocationDto {
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
  parentId?: string | null;
}
