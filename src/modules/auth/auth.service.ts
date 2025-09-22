import { ApiError } from "../../utils/api-error";
import { JwtService } from "../jwt/jwt.service";
import { MailService } from "../mail/mail.service";
import { PasswordService } from "../password/password.service";
import { PrismaService } from "../prisma/prisma.service";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto";
import { LoginDTO } from "./dto/login.dto";
import { RegisterTenantDTO } from "./dto/register-tenant.dto";
import { RegisterDTO } from "./dto/register.dto";
import { ResetPasswordDTO } from "./dto/reset-password.dto";
import { UpdateEmailDTO } from "./dto/update-email.dto";
import { OAuthUserData } from "./types/oauth.type";

export class AuthService {
  private prisma: PrismaService;
  private passwordService: PasswordService;
  private jwtService: JwtService;
  private mailService: MailService;

  constructor() {
    this.prisma = new PrismaService();
    this.passwordService = new PasswordService();
    this.jwtService = new JwtService();
    this.mailService = new MailService();
  }

  register = async (body: RegisterDTO) => {
    const user = await this.prisma.user.findFirst({
      where: { email: body.email },
    });

    if (user) {
      throw new ApiError("Email already used", 400);
    }

    const newUser = await this.prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        isVerified: false,
      },
      omit: { password: true },
    });

    const payload = { id: newUser.id };
    const token = this.jwtService.generateToken(
      payload,
      process.env.JWT_SECRET_VERIFY!,
      { expiresIn: "1h" }
    );

    const verificationLink = `http://localhost:3000/register/verify-email/${token}`;

    await this.mailService.sendMail(
      body.email,
      "Verify Your Email - PropertyRent",
      "verify-email",
      {
        userName: newUser.name,
        verificationLink,
        currentYear: new Date().getFullYear(),
      }
    );

    return {
      success: true,
      message: "Registration success, please check your email for verification",
    };
  };

  login = async (body: LoginDTO) => {
    const user = await this.prisma.user.findFirst({
      where: { email: body.email },
    });

    if (!user) {
      throw new ApiError("Invalid Credentials", 400);
    }

    if (!user.isVerified || !user.password) {
      throw new ApiError("Please verify your email first", 400);
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      body.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new ApiError("Invalid Credentials", 400);
    }

    const payload = { id: user.id, role: user.role };

    const accessToken = this.jwtService.generateToken(
      payload,
      process.env.JWT_SECRET!,
      { expiresIn: "2h" }
    );

    const { password, ...userWithoutPassword } = user;

    return { ...userWithoutPassword, accessToken };
  };

  // auth.service.ts - Update registerTenant
  registerTenant = async (body: RegisterTenantDTO) => {
    const user = await this.prisma.user.findFirst({
      where: { email: body.email },
    });

    if (user) {
      throw new ApiError("Email already used", 400);
    }

    const hashedPassword = await this.passwordService.hashPassword(
      body.password
    );

    const newTenant = await this.prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: "TENANT",
        isVerified: false,
      },
      omit: { password: true },
    });

    const payload = { id: newTenant.id };
    const token = this.jwtService.generateToken(
      payload,
      process.env.JWT_SECRET_VERIFY!,
      { expiresIn: "1h" }
    );

    const verificationLink = `http://localhost:3000/register/verify-email-tenant/${token}`;

    await this.mailService.sendMail(
      body.email,
      "Verify Your Email - PropertyRent Tenant",
      "verify-email",
      {
        userName: newTenant.name,
        verificationLink,
        currentYear: new Date().getFullYear(),
      }
    );

    return {
      success: true,
      message:
        "Tenant registration success, please check your email for verification",
    };
  };

  forgotPassword = async (body: ForgotPasswordDTO) => {
    const user = await this.prisma.user.findFirst({
      where: { email: body.email },
    });

    if (!user) {
      throw new ApiError("Invalid Credentials", 400);
    }

    const payload = { id: user.id };

    const token = this.jwtService.generateToken(
      payload,
      process.env.JWT_SECRET_RESET!,
      { expiresIn: "15m" }
    );

    const resetLink = `http://localhost:3000/reset-password/${token}`;

    await this.mailService.sendMail(
      body.email,
      "Reset Your Password",
      "forgot-password",
      {
        name: user.name,
        resetLink: resetLink,
        expiryMinutes: "15",
        year: new Date().getFullYear(),
      }
    );

    return { message: "Send Email Success" };
  };

  resetPassword = async (body: ResetPasswordDTO, authUserId: number) => {
    const user = await this.prisma.user.findFirst({
      where: { id: authUserId },
    });

    if (!user) {
      throw new ApiError("User Not Found", 400);
    }

    const hashedPassword = await this.passwordService.hashPassword(
      body.password
    );

    await this.prisma.user.update({
      where: { id: authUserId },
      data: { password: hashedPassword },
    });

    return { message: "Reset Password Success" };
  };

  verifyEmailAndSetPassword = async (token: string, password: string) => {
    const decoded = this.jwtService.verifyToken(
      token,
      process.env.JWT_SECRET_VERIFY!
    ) as { id: number };

    const user = await this.prisma.user.findFirst({
      where: { id: decoded.id },
    });

    if (!user) {
      throw new ApiError("User not found", 400);
    }

    if (user.isVerified) {
      throw new ApiError("User already verified", 400);
    }

    const hashedPassword = await this.passwordService.hashPassword(password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isVerified: true,
      },
    });

    try {
      const emailSubject =
        user.role === "TENANT"
          ? "Welcome Tenant - PropertyRent!"
          : "Welcome to PropertyRent!";

      await this.mailService.sendMail(user.email, emailSubject, "welcome", {
        name: user.name,
        year: new Date().getFullYear(),
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    return {
      message: "Email verified and password set successfully. Please login.",
    };
  };

  resendVerification = async (email: string) => {
    const user = await this.prisma.user.findFirst({ where: { email } });

    if (!user) throw new ApiError("User not found", 400);
    if (user.isVerified) throw new ApiError("User already verified", 400);

    const payload = { id: user.id };
    const token = this.jwtService.generateToken(
      payload,
      process.env.JWT_SECRET_VERIFY!,
      { expiresIn: "1h" }
    );

    const verificationLink =
      user.role === "TENANT"
        ? `http://localhost:3000/register/verify-email-tenant/${token}`
        : `http://localhost:3000/register/verify-email/${token}`;

    const emailSubject =
      user.role === "TENANT"
        ? "Verify Your Email - PropertyRent Tenant"
        : "Verify Your Email - PropertyRent";

    await this.mailService.sendMail(email, emailSubject, "verify-email", {
      userName: user.name,
      verificationLink,
      currentYear: new Date().getFullYear(),
    });

    return { message: "Verification email resent" };
  };

  loginWithOAuth = async (
    userData: OAuthUserData,
    role: "USER" | "TENANT" = "USER"
  ) => {
    try {
      let user = await this.prisma.user.findFirst({
        where: { email: userData.email },
      });

      if (user) {
        if (!user.provider || user.provider !== userData.provider) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              provider: userData.provider,
              providerId: userData.providerId,
              avatar: userData.avatar,
              isVerified: true, 
            },
          });
        }
      } else {
        user = await this.prisma.user.create({
          data: {
            name: userData.name,
            email: userData.email,
            provider: userData.provider,
            providerId: userData.providerId,
            avatar: userData.avatar,
            pictureProfile: userData.avatar, 
            isVerified: true, 
            role: role, 
          },
        });

        try {
          await this.mailService.sendMail(
            userData.email,
            "Welcome to PropertyRent!",
            "welcome",
            {
              name: userData.name,
              year: new Date().getFullYear(),
            }
          );
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
        }
      }

      if (!user) {
        throw new ApiError("Failed to create or update user", 500);
      }

      const payload = { id: user.id, role: user.role };
      const accessToken = this.jwtService.generateToken(
        payload,
        process.env.JWT_SECRET!,
        { expiresIn: "2h" }
      );

      const { password, ...userWithoutPassword } = user;
      return { ...userWithoutPassword, accessToken };
    } catch (error) {
      console.error("OAuth login error:", error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("OAuth login failed", 500);
    }
  };

  verifyEmailTenant = async (token: string) => {
    const decoded = this.jwtService.verifyToken(
      token,
      process.env.JWT_SECRET_VERIFY!
    ) as { id: number };

    const user = await this.prisma.user.findFirst({
      where: { id: decoded.id },
    });

    if (!user) {
      throw new ApiError("User not found", 400);
    }

    if (user.isVerified) {
      throw new ApiError("User already verified", 400);
    }

    if (user.role !== "TENANT") {
      throw new ApiError("Invalid verification link", 400);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
      },
    });

    try {
      await this.mailService.sendMail(
        user.email,
        "Welcome Tenant - PropertyRent!",
        "welcome",
        {
          name: user.name,
          year: new Date().getFullYear(),
        }
      );
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    return {
      message: "Email verified successfully. You can now login as tenant.",
    };
  };

  updateEmail = async (userId: number, body: UpdateEmailDTO) => {
  const user = await this.prisma.user.findFirst({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  if (!user.password) {
    throw new ApiError("Password required for email update", 400);
  }

  const isPasswordValid = await this.passwordService.comparePassword(
    body.password,
    user.password
  );

  if (!isPasswordValid) {
    throw new ApiError("Invalid password", 400);
  }

  const existingUser = await this.prisma.user.findFirst({
    where: { 
      email: body.newEmail,
      id: { not: userId }
    },
  });

  if (existingUser) {
    throw new ApiError("Email already used by another account", 400);
  }

  if (user.email === body.newEmail) {
    throw new ApiError("New email must be different from current email", 400);
  }

  const payload = { id: userId, newEmail: body.newEmail };
  const token = this.jwtService.generateToken(
    payload,
    process.env.JWT_SECRET_EMAIL_UPDATE!,
    { expiresIn: "1h" }
  );

  await this.prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmail: body.newEmail,
      emailVerificationToken: token,
      emailTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  const verificationLink = `${process.env.FRONTEND_URL}/verify-new-email/${token}`;

  await this.mailService.sendMail(
    body.newEmail,
    "Verify Your New Email - PropertyRent",
    "verify-new-email", // Butuh template baru
    {
      userName: user.name,
      newEmail: body.newEmail,
      verificationLink,
      currentYear: new Date().getFullYear(),
    }
  );

  return {
    success: true,
    message: "Verification email sent to your new email address",
  };
};

verifyNewEmail = async (token: string) => {
  const decoded = this.jwtService.verifyToken(
    token,
    process.env.JWT_SECRET_EMAIL_UPDATE!
  ) as { id: number; newEmail: string };

  const user = await this.prisma.user.findFirst({
    where: { 
      id: decoded.id,
      emailVerificationToken: token,
    },
  });

  if (!user) {
    throw new ApiError("Invalid or expired verification token", 400);
  }

  if (user.emailTokenExpiry && user.emailTokenExpiry < new Date()) {
    throw new ApiError("Verification token has expired", 400);
  }

  if (user.pendingEmail !== decoded.newEmail) {
    throw new ApiError("Email verification mismatch", 400);
  }

  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      email: user.pendingEmail,
      pendingEmail: null,
      emailVerificationToken: null,
      emailTokenExpiry: null,
      isVerified: true,
    },
  });

  try {
    await this.mailService.sendMail(
      user.email, 
      "Email Address Changed - PropertyRent",
      "email-changed-notification",
      {
        userName: user.name,
        newEmail: decoded.newEmail,
        currentYear: new Date().getFullYear(),
      }
    );

    await this.mailService.sendMail(
      decoded.newEmail, 
      "Email Address Successfully Updated - PropertyRent",
      "email-update-success",
      {
        userName: user.name,
        currentYear: new Date().getFullYear(),
      }
    );
  } catch (emailError) {
    console.error("Failed to send email confirmation:", emailError);
  }

  return {
    message: "Email successfully updated and verified",
  };
};

resendEmailVerification = async (userId: number) => {
  const user = await this.prisma.user.findFirst({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  if (user.pendingEmail) {
    const payload = { id: userId, newEmail: user.pendingEmail };
    const token = this.jwtService.generateToken(
      payload,
      process.env.JWT_SECRET_EMAIL_UPDATE!,
      { expiresIn: "1h" }
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const verificationLink = `${process.env.FRONTEND_URL}/verify-new-email/${token}`;

    await this.mailService.sendMail(
      user.pendingEmail,
      "Verify Your New Email - PropertyRent",
      "verify-new-email",
      {
        userName: user.name,
        newEmail: user.pendingEmail,
        verificationLink,
        currentYear: new Date().getFullYear(),
      }
    );

    return { message: "Verification email resent to your new email address" };
  }

  if (!user.isVerified) {
    const payload = { id: user.id };
    const token = this.jwtService.generateToken(
      payload,
      process.env.JWT_SECRET_VERIFY!,
      { expiresIn: "1h" }
    );

    const verificationLink = user.role === "TENANT"
      ? `${process.env.FRONTEND_URL}/register/verify-email-tenant/${token}`
      : `${process.env.FRONTEND_URL}/register/verify-email/${token}`;

    await this.mailService.sendMail(
      user.email,
      "Verify Your Email - PropertyRent",
      "verify-email",
      {
        userName: user.name,
        verificationLink,
        currentYear: new Date().getFullYear(),
      }
    );

    return { message: "Verification email resent to your current email address" };
  }

  throw new ApiError("Email is already verified", 400);
};
}
