import IOredis from "ioredis";

export const connection = new IOredis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null,
});
