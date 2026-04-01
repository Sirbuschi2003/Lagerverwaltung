import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

import { UserRole } from "../entities/user.entity";

export class CreateUserDto {
  @IsString()
  @MaxLength(120)
  username!: string;

  @IsString()
  @MaxLength(255)
  password!: string;

  @IsString()
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  role!: UserRole;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsOptional()
  refreshInterval?: number;
}

