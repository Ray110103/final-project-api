import express, { Express } from "express";
import cors from "cors";
import { PORT } from "./config/env";
import { SampleRouter } from "./modules/sample/sample.router";
import { errorMiddleware } from "./middlewares/error.middleware";
import { AuthRouter } from "./modules/auth/auth.router";
import { ProfileRouter } from "./modules/profile/profile.router";
import { TransactionRouter } from "./modules/transaction/transaction.router";

export class App {
  app: Express;

  constructor() {
    this.app = express();
    this.configure();
    this.routes();
    this.handleError();
  }

  private configure() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private routes() {
    const sampleRouter = new SampleRouter();
    const authRouter = new AuthRouter();
    const profileRouter = new ProfileRouter();
    const transactionRouter = new TransactionRouter();

    this.app.use("/samples", sampleRouter.getRouter);
    this.app.use("/auth", authRouter.getRouter());
    this.app.use("/profile", profileRouter.getRouter());
    this.app.use("/transactions", transactionRouter.getRouter());
  }

  private handleError() {
    this.app.use(errorMiddleware);
  }

  public start() {
    this.app.listen(PORT, () => {
      console.log(`Server Running On Port: ${PORT}`);
    });
  }
}
