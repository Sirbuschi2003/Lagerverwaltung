import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Aktuelles Passwort ist erforderlich' })
  currentPassword!: string;

  @IsNotEmpty({ message: 'Neues Passwort ist erforderlich' })
  @MinLength(8, { message: 'Passwort muss mindestens 8 Zeichen lang sein' })
  newPassword!: string;
}