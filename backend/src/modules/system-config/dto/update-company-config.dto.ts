import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCompanyConfigDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  logoDataUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  removeLogo?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string | null;
}
