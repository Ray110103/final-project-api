// /Review/dto/get-reviews.dto.ts
import { IsNumber } from "class-validator";
import { PaginationQueryParams } from "../../pagination/dto/pagination.dto";

export class GetReviewsDTO extends PaginationQueryParams {
  @IsNumber()
  propertyId!: number;
}