import { Router } from "express";
import passport from "passport";
import { AuthController } from "./auth.controller";
import { validateBody } from "../../middlewares/validate.middleware";
import { RegisterDTO } from "./dto/register.dto";
import { LoginDTO } from "./dto/login.dto";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto";
import { ResetPasswordDTO } from "./dto/reset-password.dto";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { RegisterTenantDTO } from "./dto/register-tenant.dto";
import { ResendVerificationDTO } from "./dto/resend-verification.dto";
import { VerifyNewEmailDTO } from "./dto/verify-new-email.dto";
import { UpdateEmailDTO } from "./dto/update-email.dto";

export class AuthRouter {
  private authController: AuthController;
  private router: Router;
  private jwtMiddleware: JwtMiddleware;

  constructor() {
    this.router = Router();
    this.authController = new AuthController();
    this.jwtMiddleware = new JwtMiddleware();
    this.initializeRoutes();
  }

  private initializeRoutes = () => {
    // Traditional Auth Routes
    this.router.post(
      "/register",
      validateBody(RegisterDTO),
      this.authController.register
    );

    this.router.post(
      "/register/tenant",
      validateBody(RegisterDTO), // Gunakan RegisterDTO yang sama
      this.authController.registerTenant
    );

    this.router.post(
      "/login",
      validateBody(LoginDTO),
      this.authController.login
    );

    this.router.post(
      "/forgot-password",
      validateBody(ForgotPasswordDTO),
      this.authController.forgotPassword
    );

    this.router.patch(
      "/reset-password",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET_RESET!),
      validateBody(ResetPasswordDTO),
      this.authController.resetPassword
    );

    this.router.post(
      "/verify-email",
      this.authController.verifyEmailAndSetPassword
    );

    this.router.post(
      "/verify-email/tenant",
      this.authController.verifyEmailTenant
    );

    this.router.post(
      "/resend-verification",
      validateBody(ResendVerificationDTO),
      this.authController.resendVerification
    );

    // OAuth Routes - Google
    this.router.get(
      "/google",
      passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "consent", // Force consent screen untuk development
        accessType: "offline",
      })
    );

    this.router.get(
      "/google/callback",
      passport.authenticate("google", {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
      }),
      this.authController.googleCallback
    );

    this.router.get(
      "/github",
      passport.authenticate("github", {
        scope: ["user:email"],
      })
    );

    this.router.get(
      "/github/callback",
      passport.authenticate("github", {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
      }),
      this.authController.githubCallback
    );

    this.router.patch(
      "/update-email",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      validateBody(UpdateEmailDTO),
      this.authController.updateEmail
    );

    this.router.post(
      "/verify-new-email",
      validateBody(VerifyNewEmailDTO),
      this.authController.verifyNewEmail
    );

    this.router.post(
      "/resend-email-verification",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.authController.resendEmailVerification
    );
  };

  getRouter = () => {
    return this.router;
  };
}
