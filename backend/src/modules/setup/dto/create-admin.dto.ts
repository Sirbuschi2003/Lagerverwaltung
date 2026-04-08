import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";

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
  @MinLength(8)
  @MaxLength(255)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message: 'Passwort muss mindestens einen Großbuchstaben, eine Zahl und ein Sonderzeichen enthalten',
  })
  password!: string;
}
