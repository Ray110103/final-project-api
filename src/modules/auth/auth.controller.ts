import { Request, Response } from "express";
import { AuthService } from "./auth.service";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response) => {
    try {
      const result = await this.authService.register(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Something went wrong",
      });
    }
  };

  registerTenant = async (req: Request, res: Response) => {
    const result = await this.authService.registerTenant(req.body);
    res.status(200).send(result);
  };

  login = async (req: Request, res: Response) => {
    const result = await this.authService.login(req.body);
    res.status(200).send(result);
  };

  forgotPassword = async (req: Request, res: Response) => {
    const result = await this.authService.forgotPassword(req.body);
    res.status(200).send(result);
  };

  resetPassword = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const result = await this.authService.resetPassword(req.body, authUserId);
    res.status(200).send(result);
  };

  verifyEmailAndSetPassword = async (req: Request, res: Response) => {
    const { token, password } = req.body; // token + password dari frontend
    const result = await this.authService.verifyEmailAndSetPassword(
      token,
      password
    );
    res.status(200).send(result);
  };
}
