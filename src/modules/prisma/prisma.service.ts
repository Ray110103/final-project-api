import { PrismaClient } from "../../generated/prisma";

export class PrismaService extends PrismaClient {
  constructor() {
    super();

        process.on("SIGINT", async () => {
          await this.$disconnect();
          process.exit(0);
        });
  }
}