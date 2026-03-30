import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class CreateInitialAdminDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(255)
  password!: string;
}
