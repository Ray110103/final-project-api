import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utils/api-error";
import { ProfileService } from "./tenant.service";

export class ProfileController {
  private profileService: ProfileService;

  constructor() {
    this.profileService = new ProfileService();
  }

  getTenantProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new ApiError("Invalid tenant ID", 400);
      }

      const result = await this.profileService.getTenantById(id);
      res.status(200).json(result);
    } catch (error) {
      next(error); // penting untuk error middleware
    }
  };
}
