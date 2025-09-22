import IOredis from "ioredis";

export const connection = new IOredis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);
