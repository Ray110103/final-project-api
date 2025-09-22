import { plainToInstance } from "class-transformer";
import { IsNotEmpty, IsNumber, IsString, validateSync } from "class-validator";

class EnvConfig {
  @IsNotEmpty() @IsNumber() PORT!: number;
  @IsNotEmpty() @IsString() DATABASE_URL!: string;

  @IsNotEmpty() @IsString() JWT_SECRET!: string;
  @IsNotEmpty() @IsString() JWT_SECRET_RESET_PASSWORD!: string;
  @IsNotEmpty() @IsString() JWT_SECRET_FORGOT_PASSWORD!: string;
  @IsNotEmpty() @IsString() JWT_SECRET_VERIFICATION!: string;

  @IsNotEmpty() @IsString() MAIL_USER!: string;
  @IsNotEmpty() @IsString() MAIL_PASSWORD!: string;

  @IsNotEmpty() @IsString() CLOUDINARY_API_KEY!: string;
  @IsNotEmpty() @IsString() CLOUDINARY_API_SECRET!: string;
  @IsNotEmpty() @IsString() CLOUDINARY_CLOUD_NAME!: string;

  @IsNotEmpty() @IsString() GOOGLE_CLIENT_ID!: string;
  @IsNotEmpty() @IsString() GOOGLE_CLIENT_SECRET!: string;
}

export const env = () => {
  const config = plainToInstance(EnvConfig, process.env, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(config, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation error: ${errors
        .map((err) => Object.values(err.constraints || {}).join(", "))
        .join("; ")}`
    );
  }

  return config;
};