import { sign, SignOptions } from "jsonwebtoken";

export class JwtService {
    generateToken = (payload: any, secretKey: string, options: SignOptions) => {
        return sign(payload, secretKey, options)
    }
}