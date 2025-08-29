import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware";
import { ProfileController } from "./profile.controller";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { validateBody } from "../../middlewares/validate.middleware";

export class ProfileRouter {
  private router: Router;
  private jwtMiddleware: JwtMiddleware;
  private uploaderMiddleware: UploaderMiddleware;
  private profileController: ProfileController;
  constructor() {
    this.router = Router();
    this.profileController = new ProfileController();
    this.jwtMiddleware = new JwtMiddleware();
    this.uploaderMiddleware = new UploaderMiddleware();
    this.initializeRoutes();
  }

  private initializeRoutes = () => {
    this.router.get(
      "/",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.profileController.getProfile
    );
    this.router.patch(
      "/edit",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.uploaderMiddleware
        .upload()
        .fields([{ name: "pictureProfile", maxCount: 1 }]),
      this.uploaderMiddleware.fileFilter([
        "image/jpeg",
        "image/png",
        "image/avif",
        "image/webp",
      ]),
      validateBody(UpdateProfileDto),
      this.profileController.updateProfile
    );

    this.router.patch(
      "/change-password",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      validateBody(ChangePasswordDto),
      this.profileController.changePassword
    );
  };

  getRouter = () => {
    return this.router;
  };
}
