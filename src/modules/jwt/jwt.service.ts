import { JwtPayload, sign, SignOptions, verify } from "jsonwebtoken";

export class JwtService {
  generateToken = (payload: any, secretKey: string, options: SignOptions) => {
    return sign(payload, secretKey, options);
  };

  verifyToken = <T extends JwtPayload>(token: string, secretKey: string): T => {
    try {
      return verify(token, secretKey) as T;
    } catch (err) {
      throw new Error("Invalid or expired token");
    }
  };
}
