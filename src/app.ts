import cors from "cors";
import express, { Express } from "express";
import { PORT } from "./config/env";
import { errorMiddleware } from "./middlewares/error.middleware";
import { AuthRouter } from "./modules/auth/auth.router";
import { ProfileRouter } from "./modules/profile/profile.router";
import { RoomRouter } from "./modules/room/room.router";
import { SampleRouter } from "./modules/sample/sample.router";
import "./config/passport";
import passport from "passport";

import { PropertyRouter } from "./modules/property/property.router";
import { TransactionRouter } from "./modules/transaction/transaction.router";
import { ReviewRouter } from "./modules/review/review.router";
import { ReportRouter } from "./modules/report/report.router";


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
    this.app.use(passport.initialize());
  }

  private routes() {
    const sampleRouter = new SampleRouter();
    const authRouter = new AuthRouter();
    const profileRouter = new ProfileRouter();
    const propertyRouter = new PropertyRouter();
    const roomRouter = new RoomRouter();
    const transactionRouter = new TransactionRouter();
    const reviewRouter = new ReviewRouter();
    const reportRouter = new ReportRouter();

    

    this.app.use("/samples", sampleRouter.getRouter);
    this.app.use("/auth", authRouter.getRouter());
    this.app.use("/profile", profileRouter.getRouter());
    this.app.use("/rooms", roomRouter.getRouter());
    this.app.use("/property", propertyRouter.getRouter());
    this.app.use("/reviews", reviewRouter.getRouter());
    

        this.app.use("/transactions", transactionRouter.getRouter());

    this.app.use("/reports", reportRouter.getRouter());

    // Health check
    this.app.get("/health", (req, res) => {
      res.status(200).send({ status: "OK" });
    });
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
