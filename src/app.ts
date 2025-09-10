import cors from "cors";
import express, { Express } from "express";
import { PORT } from "./config/env";
import { errorMiddleware } from "./middlewares/error.middleware";
import { AuthRouter } from "./modules/auth/auth.router";
import { ProfileRouter } from "./modules/profile/profile.router";
import { PropertyRouter } from "./modules/property/property.router";
import { RoomRouter } from "./modules/room/room.router";
import { SampleRouter } from "./modules/sample/sample.router";
import { initializedWorkers } from "./workers";
import { CronService } from './scripts/reminder';
import { TransactionRouter } from "./modules/transaction/transaction.router";

export class App {
  app: Express;

  constructor() {
    this.app = express();
    
    // Initialize cron jobs for reminders
    new CronService(); // This will set up the automated email reminders
    
    this.configure();
    this.routes();
    this.handleError();
    initializedWorkers();
  }

  private configure() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private routes() {
    const sampleRouter = new SampleRouter();
    const authRouter = new AuthRouter();
    const profileRouter = new ProfileRouter();
    const propertyRouter = new PropertyRouter();
    const roomRouter = new RoomRouter();
    const transactionRouter = new TransactionRouter();

    this.app.use("/samples", sampleRouter.getRouter);
    this.app.use("/auth", authRouter.getRouter());
    this.app.use("/profile", profileRouter.getRouter());
    this.app.use("/rooms", roomRouter.getRouter());
    this.app.use("/property", propertyRouter.getRouter());
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
