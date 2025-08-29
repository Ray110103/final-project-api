import { NextFunction, Request, Response } from "express";
import { TokenExpiredError, verify } from "jsonwebtoken";
import { ApiError } from "../utils/api-error";

export class JwtMiddleware {
  verifyToken = (secretKey: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return next(new ApiError("No token provided", 401));
      }

      verify(token, secretKey, (err, payload) => {
        if (err) {
          if (err instanceof TokenExpiredError) {
            return next(new ApiError("Token expired", 401));
          } else {
            return next(new ApiError("Invalid Token", 401));
          }
        }

        res.locals.user = payload;
        return next();
      });
    };
  };

  verifyRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = res.locals.user;

      if (!user || !allowedRoles.includes(user.role)) {
        throw new ApiError("Forbidden", 403);
      }

      next();
    };
  };
}
