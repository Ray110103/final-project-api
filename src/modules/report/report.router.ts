// /dashboard/report/report.routes.ts
import { Router } from "express";
import { ReportController } from "./report.controller";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { validateQuery } from "../../middlewares/validation.middleware";
import { GetSalesReportDTO } from "./dto/get-sales-report.dto";
import { GetPropertyReportDTO } from "./dto/get-property-report.dto";

export class ReportRouter {
  private router: Router;
  private reportController: ReportController;
  private jwtMiddleware: JwtMiddleware;
  
  constructor() {
    this.router = Router();
    this.jwtMiddleware = new JwtMiddleware();
    this.reportController = new ReportController();
    this.initializeRoutes();
  }
  
  private initializeRoutes = () => {
    // Sales report route
    this.router.get(
      "/sales",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      validateQuery(GetSalesReportDTO),
      this.reportController.getSalesReport
    );
    
    // Property report route
    this.router.get(
      "/property",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      validateQuery(GetPropertyReportDTO),
      this.reportController.getPropertyReport
    );
  };
  
  getRouter = () => {
    return this.router;
  };
}