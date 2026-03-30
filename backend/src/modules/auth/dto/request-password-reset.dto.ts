import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'Gültige E-Mail-Adresse erforderlich' })
  @IsNotEmpty({ message: 'E-Mail-Adresse ist erforderlich' })
  email!: string;
}