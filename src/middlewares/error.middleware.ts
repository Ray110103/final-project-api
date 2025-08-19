import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error";

export const errorMiddleware = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
    const status = err.status || 500
    const message = err.message ||  "Something Went Wrong"
    res.status(status).send({message})
};
