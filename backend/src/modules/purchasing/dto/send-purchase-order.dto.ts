import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class SendPurchaseOrderDto {
  @IsOptional()
  @IsEmail()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
