import { NextFunction, Request, Response } from "express";

export const checkVerified = (req: Request, res: Response, next: NextFunction) => {
  if (!res.locals.user.isVerified) {
    return res.status(403).json({ message: "Please verify your email before making orders" });
  }
  next();
};
