import { plainToInstance } from "class-transformer";
import { validate } from "class-validator"; // Corrected import
import { PropertyService } from "./property.service";
import { PaginationQueryParams } from "../pagination/dto/pagination.dto";
import { Request, Response } from "express";
import { ApiError } from "../../utils/api-error";
import { GetPropertiesByTenantDTO } from "./dto/get-properties-by-tenant.dto"; // Assuming you already have this DTO

export class PropertyController {
  private propertyService: PropertyService;

  constructor() {
    this.propertyService = new PropertyService();
  }

  /// Method to get properties and rooms by tenantId
  getPropertiesByTenant = async (req: Request, res: Response) => {
    // Get tenantId from the route parameter
    const tenantId = parseInt(req.params.tenantId);

    // Check if tenantId is valid
    if (isNaN(tenantId)) {
      return res.status(400).send({ message: "Invalid tenantId" });
    }

    // Validate query params (pagination, filtering, etc.)
    const queryParams = plainToInstance(GetPropertiesByTenantDTO, req.query);
    const errors = await validate(queryParams); // Validate query parameters

    if (errors.length > 0) {
      return res.status(400).send({ message: "Invalid query parameters", errors });
    }

    try {
      // Fetch properties using the tenantId and validated query parameters
      const properties = await this.propertyService.getPropertiesByTenant(tenantId, queryParams);
      res.status(200).send(properties); // Send response with the properties and related rooms
    } catch (error) {
      // Handle errors (e.g., property not found, unexpected errors)
      if (error instanceof ApiError) {
        res.status(error.statusCode).send({ message: error.message });
      } else {
        res.status(500).send({ message: "An unexpected error occurred" });
      }
    }
  };

  // Existing getProperty method
  getProperty = async (req: Request, res: Response) => {
    const query = plainToInstance(PaginationQueryParams, req.query);
    const result = await this.propertyService.getProperties(query);
    res.status(200).send(result);
  };

  // Existing getPropertyBySlug method
  getPropertyBySlug = async (req: Request, res: Response) => {
    const slug = req.params.slug;
    const result = await this.propertyService.getPropertyBySlug(slug);
    res.status(200).send(result);
  };

  // Existing createProperty method
  createProperty = async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const thumbnail = files?.thumbnail?.[0];
    const images = files?.images || []; // ✅ multiple images

    // Ensure thumbnail is present
    if (!thumbnail) throw new ApiError("Thumbnail is required", 400);

    // Create the property
    const result = await this.propertyService.createProperty(
      req.body,
      thumbnail,
      res.locals.user.id, // userId from JWT / auth middleware
      images // ✅ pass to service for multiple images
    );

    // Respond with success message
    res.status(201).send(result);
  };
}
