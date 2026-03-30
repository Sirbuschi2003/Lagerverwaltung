import { IsDateString, IsNotEmpty, IsString } from "class-validator";

export class CompleteInventoryDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsDateString()
  completedAt!: string;
}

