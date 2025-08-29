import { Router } from "express";
import { ProfileController } from "./tenant.controller";

export class ProfileRouter {
  private router: Router;
  private profileController: ProfileController;

  constructor() {
    this.router = Router();
    this.profileController = new ProfileController();
    this.initializeRoutes();
  }

  private initializeRoutes = () => {
    this.router.get(
      "/tenant/:id",
      this.profileController.getTenantProfile
    );
  };

  getRouter = () => {
    return this.router;
  };
}
