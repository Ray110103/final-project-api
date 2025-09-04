import { plainToInstance } from "class-transformer";
import { PropertyService } from "./property.service";
import { PaginationQueryParams } from "../pagination/dto/pagination.dto";
import { Request, Response } from "express";
import { CreatePropertyDTO } from "./dto/create-property.dto";
import { validateBody } from "../../middlewares/validate.middleware";
import { ApiError } from "../../utils/api-error";

export class PropertyController {
  private propertyService: PropertyService;

  constructor() {
    this.propertyService = new PropertyService();
  }

  getProperty = async (req: Request, res: Response) => {
    const query = plainToInstance(PaginationQueryParams, req.query);
    const result = await this.propertyService.getProperties(query);
    res.status(200).send(result);
  };

  getPropertyBySlug = async (req: Request, res: Response) => {
    const slug = req.params.slug;
    const result = await this.propertyService.getPropertyBySlug(slug);
    res.status(200).send(result);
  }

  createProperty = async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const thumbnail = files?.thumbnail?.[0];

    if (!thumbnail) throw new ApiError("thumbnail is required", 400);

    const result = await this.propertyService.createProperty(
      req.body,
      thumbnail,
      res.locals.user.id // userId dari JWT / auth middleware
    );

    res.status(201).send(result);
  };
}
