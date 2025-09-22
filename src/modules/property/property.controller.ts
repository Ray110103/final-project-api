import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PropertyService } from "./property.service";
import { PaginationQueryParams } from "../pagination/dto/pagination.dto";
import { Request, Response } from "express";
import { ApiError } from "../../utils/api-error";
import { GetPropertiesDTO } from "./dto/get-properties.dto";
import { UpdatePropertyDTO } from "./dto/update-property.dto";

export class PropertyController {
  private propertyService: PropertyService;

  constructor() {
    this.propertyService = new PropertyService();
  }

  getProperties = async (req: Request, res: Response) => {
    try {
      const queryDto = plainToInstance(GetPropertiesDTO, req.query);
      const errors = await validate(queryDto);

      if (errors.length > 0) {
        const errorMessages = errors
          .map((error) => Object.values(error.constraints || {}).join(", "))
          .join("; ");
        throw new ApiError(`Invalid query parameters: ${errorMessages}`, 400);
      }

      const result = await this.propertyService.getProperties(queryDto);
      res.status(200).send(result);
    } catch (error) {
      console.error("Error in getProperty:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Error fetching properties" });
      }
    }
  };

  // Add this method to your PropertyController class

  getLocations = async (req: Request, res: Response) => {
    try {
      console.log("getLocations endpoint called");
      const locations = await this.propertyService.getUniqueLocations();
      console.log("Locations found:", locations);
      res.status(200).json(locations);
    } catch (error) {
      console.error("Error getting locations:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Error fetching locations" });
      }
    }
  };

  getPropertiesForTenant = async (req: Request, res: Response) => {
    try {
      const queryDto = plainToInstance(GetPropertiesDTO, req.query);
      const errors = await validate(queryDto);
      if (errors.length > 0) {
        throw new ApiError("Invalid query parameters", 400);
      }

      const query: GetPropertiesDTO = {
        ...queryDto,
        page: queryDto.page || 1,
        take: queryDto.take || 10,
        sortBy: queryDto.sortBy || "createdAt",
        sortOrder: queryDto.sortOrder || "asc",
      };

      const tenantId = res.locals.user?.id;

      if (!tenantId) {
        throw new ApiError("User not authenticated", 401);
      }

      const result = await this.propertyService.getPropertiesForTenant(
        tenantId,
        query
      );

      res.status(200).json(result);
    } catch (error) {
      console.error("Error in getPropertiesForTenant:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  };

  getPropertyBySlug = async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug;
      const result = await this.propertyService.getPropertyBySlug(slug);
      res.status(200).send(result);
    } catch (error) {
      console.error("Error in getPropertyBySlug:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Error fetching property" });
      }
    }
  };

  createProperty = async (req: Request, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const thumbnail = files?.thumbnail?.[0];
      const images = files?.images || [];

      if (!thumbnail) throw new ApiError("Thumbnail is required", 400);

      const result = await this.propertyService.createProperty(
        req.body,
        thumbnail,
        res.locals.user.id,
        images
      );

      res.status(201).send(result);
    } catch (error) {
      console.error("Error in createProperty:", error);
      throw new ApiError("Error creating property", 500);
    }
  };

  updateProperty = async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug;
      const tenantId = res.locals.user?.id;

      if (!tenantId) {
        throw new ApiError("User not authenticated", 401);
      }

      const bodyDto = plainToInstance(UpdatePropertyDTO, req.body);
      const errors = await validate(bodyDto);
      if (errors.length > 0) {
        const errorMessages = errors
          .map((error) => Object.values(error.constraints || {}).join(", "))
          .join("; ");
        throw new ApiError(`Validation failed: ${errorMessages}`, 400);
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const thumbnail = files?.thumbnail?.[0];
      const images = files?.images || [];

      const result = await this.propertyService.updateProperty(
        slug,
        bodyDto,
        tenantId,
        thumbnail,
        images
      );

      res.status(200).json(result);
    } catch (error) {
      console.error("Error in updateProperty:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  };

  deleteProperty = async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug;
      await this.propertyService.deleteProperty(slug);
      res.status(200).send({ message: "Property deleted successfully" });
    } catch (error) {
      console.error("Error in deleteProperty:", error);
      throw new ApiError("Error deleting property", 500);
    }
  };

  getCategories = async (req: Request, res: Response) => {
    try {
      const tenantId = res.locals.user?.id;
      if (!tenantId) {
        throw new ApiError("User not authenticated", 401);
      }

      const categories = await this.propertyService.getCategoriesForTenant(
        tenantId
      );
      res.status(200).json(categories);
    } catch (error) {
      console.error("Error getting categories:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Error fetching categories" });
      }
    }
  };

  createCategory = async (req: Request, res: Response) => {
    try {
      const tenantId = res.locals.user?.id;
      if (!tenantId) {
        throw new ApiError("User not authenticated", 401);
      }

      const { name, isActive } = req.body; // Removed description

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        throw new ApiError("Category name is required", 400);
      }

      const category = await this.propertyService.createCategory(
        {
          name: name.trim(),
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        },
        tenantId
      );

      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Error creating category" });
      }
    }
  };

  // Update controller validation
  updateCategory = async (req: Request, res: Response) => {
    try {
      const tenantId = res.locals.user?.id;
      const categorySlug = req.params.slug;

      if (!tenantId) {
        throw new ApiError("User not authenticated", 401);
      }

      // Simplified validation - just check if slug exists
      if (!categorySlug) {
        throw new ApiError("Category slug is required", 400);
      }

      const { name, isActive } = req.body;
      const updateData: any = {};

      if (name !== undefined) {
        if (typeof name !== "string" || name.trim().length === 0) {
          throw new ApiError("Category name must be a non-empty string", 400);
        }
        updateData.name = name.trim();
      }

      if (isActive !== undefined) {
        updateData.isActive = Boolean(isActive);
      }

      const category = await this.propertyService.updateCategory(
        categorySlug,
        updateData,
        tenantId
      );
      res.status(200).json(category);
    } catch (error) {
      console.error("Error updating category:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Error updating category" });
      }
    }
  };

  deleteCategory = async (req: Request, res: Response) => {
    try {
      const tenantId = res.locals.user?.id;
      const categorySlug = req.params.slug; // Changed from id to slug

      if (!tenantId) {
        throw new ApiError("User not authenticated", 401);
      }

      if (!categorySlug || typeof categorySlug !== "string") {
        throw new ApiError("Invalid category slug", 400);
      }

      await this.propertyService.deleteCategory(categorySlug, tenantId);
      res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Error deleting category" });
      }
    }
  };
}
