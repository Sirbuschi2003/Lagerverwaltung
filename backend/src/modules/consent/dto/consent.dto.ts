import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class GrantConsentDto {
  @IsString()
  @MaxLength(100)
  purpose!: string;

  @IsString()
  @MaxLength(20)
  version!: string;

  @IsBoolean()
  granted!: boolean;
}

export class ConsentResponseDto {
  id!: string;
  purpose!: string;
  version!: string;
  granted!: boolean;
  grantedAt!: string;
  revokedAt?: string | null;
}
