import IOredis from "ioredis";

export const connection = new IOredis({
  host: process.env.REDIS_HOST! || "localhost",
  port: Number(process.env.REDIS_PORT!)|| 6379,
  maxRetriesPerRequest: null,
});
