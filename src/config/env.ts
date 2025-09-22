import dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT || 8000;
export const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || "";
export const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || "";
export const MIDTRANS_IS_PRODUCTION = (process.env.MIDTRANS_IS_PRODUCTION || "false").toLowerCase() === "true";
