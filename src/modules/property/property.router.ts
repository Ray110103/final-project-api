// Updated PropertyRouter with locations route
import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware";
import { PropertyController } from "./property.controller";
import { validateBody } from "../../middlewares/validate.middleware";
import { CreatePropertyDTO } from "./dto/create-property.dto";
import { UpdatePropertyDTO } from "./dto/update-property.dto";

export class PropertyRouter {
  private router: Router;
  private propertyController: PropertyController;
  private jwtMiddleware: JwtMiddleware;
  private uploaderMiddleware: UploaderMiddleware;

  constructor() {
    this.router = Router();
    this.propertyController = new PropertyController();
    this.jwtMiddleware = new JwtMiddleware();
    this.uploaderMiddleware = new UploaderMiddleware();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    // ✅ Property Category Management Routes (Most specific routes first)
    
    // Get categories for tenant
    this.router.get(
      "/categories",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.propertyController.getCategories
    );

    // Create category
    this.router.post(
      "/categories",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.propertyController.createCategory
    );

    // Update category
    this.router.put(
      "/categories/:slug",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.propertyController.updateCategory
    );

    // Delete category
    this.router.delete(
      "/categories/:slug",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.propertyController.deleteCategory
    );

    // ✅ NEW: Get unique locations for dropdown
    this.router.get("/locations", this.propertyController.getLocations);

    // ✅ Tenant properties route
    this.router.get(
      "/tenant/properties",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.propertyController.getPropertiesForTenant
    );

    // ✅ Create property
    this.router.post(
      "/",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.uploaderMiddleware.upload().fields([
        { name: "thumbnail", maxCount: 1 },
        { name: "images", maxCount: 10 },
      ]),
      this.uploaderMiddleware.fileFilter([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]),
      validateBody(CreatePropertyDTO),
      this.propertyController.createProperty
    );

    // ✅ Public routes - Get all properties
    this.router.get("/", this.propertyController.getProperties);

    // ✅ Update property route (PUT method)
    this.router.put(
      "/:slug",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.uploaderMiddleware.upload().fields([
        { name: "thumbnail", maxCount: 1 },
        { name: "images", maxCount: 10 },
      ]),
      this.uploaderMiddleware.fileFilter([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]),
      this.propertyController.updateProperty
    );

    // ✅ Delete property route
    this.router.delete(
      "/:slug",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.propertyController.deleteProperty
    );

    // ✅ Dynamic route last - get property by slug
    this.router.get("/:slug", this.propertyController.getPropertyBySlug);
  };

  getRouter = () => {
    return this.router;
  };
}