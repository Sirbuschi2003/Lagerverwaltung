import { ArrayNotEmpty, IsArray, IsOptional, IsString } from "class-validator";

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}
