import { IsBoolean, IsIn, IsNumber, IsOptional, Matches } from "class-validator";

export class AutoBackupConfigDto {
  @IsBoolean()
  enabled!: boolean;

  @IsIn(["daily", "weekly", "monthly"])
  frequency!: "daily" | "weekly" | "monthly";

  @Matches(/^\d{2}:\d{2}$/, { message: "time must be HH:MM" })
  time!: string;

  @IsOptional()
  @IsNumber()
  retentionDays?: number;

  @IsOptional()
  @IsNumber()
  maxAutoBackups?: number;
}
