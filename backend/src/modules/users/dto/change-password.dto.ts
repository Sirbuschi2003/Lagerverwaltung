import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Aktuelles Passwort ist erforderlich' })
  currentPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'Neues Passwort ist erforderlich' })
  @MinLength(6, { message: 'Neues Passwort muss mindestens 6 Zeichen lang sein' })
  newPassword!: string;
}