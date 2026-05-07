import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  username!: string;

  @IsString()
  @IsNotEmpty()
  // bcrypt-DoS: Passwörter über 256 Zeichen blockieren (bcrypt gibt CPU-intensive Hashes für lange Inputs)
  @MaxLength(256)
  password!: string;
}

