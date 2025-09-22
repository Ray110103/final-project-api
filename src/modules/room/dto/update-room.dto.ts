import { Type } from "class-transformer";
import { IsOptional, IsNumberString, IsString, ValidateNested } from "class-validator";
import { RoomFacilityDTO } from "./room-facility.dto";

export class UpdateRoomsDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  property?: string; // Allow changing property (within same tenant)

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string; // Stock availability

  @IsOptional()
  @IsNumberString()
  capacity?: string; // Kapasitas tamu per room

  @IsOptional()
  @IsString()
  description?: string;

  // Room facilities - if provided, will replace all existing facilities
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RoomFacilityDTO)
  facilities?: RoomFacilityDTO[];
}