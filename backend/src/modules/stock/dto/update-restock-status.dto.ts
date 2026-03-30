import { IsIn, IsOptional, IsString, IsNumber, Min } from "class-validator";

import { RESTOCK_REQUEST_STATUSES, RestockRequestStatus } from "../entities/restock-request.entity";

export class UpdateRestockStatusDto {
  @IsOptional()
  @IsIn(RESTOCK_REQUEST_STATUSES)
  status?: RestockRequestStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  preparedByUserId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityProvided?: number;

  @IsOptional()
  @IsString()
  locationId?: string;
}
