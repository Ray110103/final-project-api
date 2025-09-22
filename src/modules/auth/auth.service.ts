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

    // buat user tanpa password & belum verified
    const newUser = await this.prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        isVerified: false,
      },
      omit: { password: true },
    });

    // generate token verifikasi
    const payload = { id: newUser.id };
    const token = this.jwtService.generateToken(
      payload,
      process.env.JWT_SECRET_VERIFY!,
      { expiresIn: "1h" }
    );

    const verificationLink = `${process.env.NEXT_PUBLIC_BASE_WEB_URL!}/register/verify-email/${token}`;

    // kirim email dengan tombol verifikasi
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

    // Hash password yang diinput user
    const hashedPassword = await this.passwordService.hashPassword(
      body.password
    );

    // Buat tenant dengan password tapi belum verified
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

    // Generate token verifikasi
    const payload = { id: newTenant.id };
    const token = this.jwtService.generateToken(
      payload,
      process.env.JWT_SECRET_VERIFY!,
      { expiresIn: "1h" }
    );

    const verificationLink = `${process.env.NEXT_PUBLIC_BASE_WEB_URL!}/register/verify-email-tenant/${token}`;

    // Kirim email verifikasi
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

    const resetLink = `${process.env.NEXT_PUBLIC_BASE_WEB_URL!}/reset-password/${token}`;

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
    // Verifikasi token
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

    // Hash password baru
    const hashedPassword = await this.passwordService.hashPassword(password);

    // Update user -> set password & verified = true
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isVerified: true,
      },
    });

    // Kirim welcome email setelah verifikasi berhasil
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
      // Don't throw error, email failure shouldn't stop verification
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

    // Tentukan verification link berdasarkan role
    const verificationLink =
      user.role === "TENANT"
        ? `${process.env.NEXT_PUBLIC_BASE_WEB_URL!}/register/verify-email-tenant/${token}`
        : `${process.env.NEXT_PUBLIC_BASE_WEB_URL!}/register/verify-email/${token}`;

    // Tentukan subject berdasarkan role
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

  // Method baru untuk OAuth login
  loginWithOAuth = async (
    userData: OAuthUserData,
    role: "USER" | "TENANT" = "USER"
  ) => {
    try {
      // Cek apakah user sudah ada berdasarkan email
      let user = await this.prisma.user.findFirst({
        where: { email: userData.email },
      });

      if (user) {
        // User sudah ada, update provider info jika belum ada
        if (!user.provider || user.provider !== userData.provider) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              provider: userData.provider,
              providerId: userData.providerId,
              avatar: userData.avatar,
              isVerified: true, // OAuth users dianggap verified
            },
          });
        }
      } else {
        // User baru, buat akun baru
        user = await this.prisma.user.create({
          data: {
            name: userData.name,
            email: userData.email,
            provider: userData.provider,
            providerId: userData.providerId,
            avatar: userData.avatar,
            pictureProfile: userData.avatar, // Gunakan field yang sudah ada
            isVerified: true, // OAuth users dianggap verified
            role: role, // Use parameter role
            // password tidak disertakan karena optional untuk OAuth users
          },
        });

        // Kirim welcome email
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
          // Don't throw error, email failure shouldn't stop OAuth login
        }
      }

      // Pastikan user tidak null sebelum generate token
      if (!user) {
        throw new ApiError("Failed to create or update user", 500);
      }

      // Generate JWT token
      const payload = { id: user.id, role: user.role };
      const accessToken = this.jwtService.generateToken(
        payload,
        process.env.JWT_SECRET!,
        { expiresIn: "2h" }
      );

      // Return user without password
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

  // Tambah method khusus untuk verify tenant (tanpa set password)
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

    // Update hanya status verified (password sudah ada)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
      },
    });

    // Kirim welcome email
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
  // Cari user berdasarkan ID
  const user = await this.prisma.user.findFirst({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Validasi password
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

  // Cek apakah email baru sudah digunakan
  const existingUser = await this.prisma.user.findFirst({
    where: { 
      email: body.newEmail,
      id: { not: userId }
    },
  });

  if (existingUser) {
    throw new ApiError("Email already used by another account", 400);
  }

  // Cek apakah email sama dengan email saat ini
  if (user.email === body.newEmail) {
    throw new ApiError("New email must be different from current email", 400);
  }

  // Generate token untuk verifikasi email baru
  const payload = { id: userId, newEmail: body.newEmail };
  const token = this.jwtService.generateToken(
    payload,
    process.env.JWT_SECRET_EMAIL_UPDATE!,
    { expiresIn: "1h" }
  );

  // Simpan pending email dan token
  await this.prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmail: body.newEmail,
      emailVerificationToken: token,
      emailTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  const verificationLink = `${process.env.FRONTEND_URL}/verify-new-email/${token}`;

  // Kirim email verifikasi ke email baru
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
  // Verifikasi token
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

  // Cek apakah token sudah expired
  if (user.emailTokenExpiry && user.emailTokenExpiry < new Date()) {
    throw new ApiError("Verification token has expired", 400);
  }

  // Cek apakah pending email masih sama
  if (user.pendingEmail !== decoded.newEmail) {
    throw new ApiError("Email verification mismatch", 400);
  }

  // Update email dari pendingEmail
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

  // Kirim konfirmasi email berhasil diubah ke email lama dan baru
  try {
    await this.mailService.sendMail(
      user.email, // email lama
      "Email Address Changed - PropertyRent",
      "email-changed-notification",
      {
        userName: user.name,
        newEmail: decoded.newEmail,
        currentYear: new Date().getFullYear(),
      }
    );

    await this.mailService.sendMail(
      decoded.newEmail, // email baru
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

  // Jika ada pending email, kirim verifikasi untuk email baru
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

  // Jika email current belum verified
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
