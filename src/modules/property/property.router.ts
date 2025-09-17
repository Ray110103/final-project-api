import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware";
import { PropertyController } from "./property.controller";
import { validateBody } from "../../middlewares/validate.middleware";
import { CreatePropertyDTO } from "./dto/create-property.dto";

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
    this.router.get("/", this.propertyController.getProperty);
    this.router.get("/:slug", this.propertyController.getPropertyBySlug);
    this.router.post(
      "/",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.uploaderMiddleware
        .upload()
        .fields([{ name: "thumbnail", maxCount: 1 }]),
      this.uploaderMiddleware.fileFilter([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]),
      validateBody(CreatePropertyDTO),
      this.propertyController.createProperty
    );
  };

  getRouter = () => {
    return this.router;
  };
}
