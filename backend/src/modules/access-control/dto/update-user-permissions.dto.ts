import { IsArray, IsOptional, IsString } from "class-validator";

export class UpdateUserPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  overrides?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  denials?: string[];
}
