// src/modules/auth/types/oauth.types.ts

// Import Role enum dari generated Prisma client
import { Role } from "../../../generated/prisma";

export interface OAuthUserData {
  email: string;
  name: string;
  provider: 'GOOGLE' | 'GITHUB';
  providerId: string;
  avatar?: string;
}

export interface OAuthProfile {
  id: string;
  email?: string;
  name?: string;
  displayName?: string;
  username?: string;
  picture?: string;
  avatar_url?: string;
  emails?: Array<{ value: string; verified?: boolean }>;
  photos?: Array<{ value: string }>;
}

export type UserRole = 'USER' | 'TENANT';