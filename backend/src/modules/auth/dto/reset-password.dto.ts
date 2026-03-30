import { IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'Token ist erforderlich' })
  token!: string;

  @IsNotEmpty({ message: 'Neues Passwort ist erforderlich' })
  @MinLength(8, { message: 'Passwort muss mindestens 8 Zeichen lang sein' })
  newPassword!: string;
}