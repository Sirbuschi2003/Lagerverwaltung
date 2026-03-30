import { IsInt, IsNotEmpty, IsUUID, Min } from "class-validator";

export class UpdateTargetDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsInt()
  @Min(0)
  targetQuantity!: number;
}
