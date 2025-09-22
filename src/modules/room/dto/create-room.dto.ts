import { Type } from "class-transformer";
import { IsNotEmpty, IsNumberString, IsOptional, IsString, ValidateNested } from "class-validator";
import { RoomFacilityDTO } from "./room-facility.dto";

export class CreateRoomsDTO {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  property!: string;

  @IsNumberString()
  @IsNotEmpty()
  price!: string;

  @IsNumberString()
  @IsNotEmpty()
  limit!: string; // Stock availability

  @IsNumberString()
  @IsNotEmpty()
  capacity!: string; // 👈 TAMBAH: Kapasitas tamu per room

  @IsString()
  @IsNotEmpty()
  description!: string;

  // Room facilities
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RoomFacilityDTO)
  facilities?: RoomFacilityDTO[]; // 👈 TAMBAH: Room facilities
}
