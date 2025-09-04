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

  const verificationLink = `http://localhost:3000/register/verify-email/${token}`;

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
      user.password!
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

  registerTenant = async (body: RegisterTenantDTO) => {
    const user = await this.prisma.user.findFirst({
      where: { email: body.email },
    });

    if (user) {
      throw new ApiError("email already exist", 400);
    }

    const hashedPassword = await this.passwordService.hashPassword(
      body.password
    );

    await this.mailService.sendMail(body.email, "Welcome Tenant!", "welcome", {
      name: body.name,
      year: new Date().getFullYear(),
    });

    const newTenant = await this.prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: "TENANT",
      },
      omit: { password: true },
    });

    return newTenant;
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
    // verifikasi token
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

    // hash password baru
    const hashedPassword = await this.passwordService.hashPassword(password);

    // update user -> set password & verified = true
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isVerified: true,
      },
    });

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

    const verificationLink = `http://localhost:3000/verify-email/${token}`;

    await this.mailService.sendMail(
      email,
      "Verify Your Email - PropertyRent",
      "verify-email",
      {
        userName: user.name,
        verificationLink,
        currentYear: new Date().getFullYear(),
      }
    );

    return { message: "Verification email resent" };
  };
}
