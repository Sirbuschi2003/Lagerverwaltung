import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Aktuelles Passwort ist erforderlich' })
  @MaxLength(256)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'Neues Passwort ist erforderlich' })
  @MinLength(8, { message: 'Passwort muss mindestens 8 Zeichen lang sein' })
  @MaxLength(256)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message: 'Passwort muss mindestens einen Großbuchstaben, eine Zahl und ein Sonderzeichen enthalten',
  })
  newPassword!: string;
}