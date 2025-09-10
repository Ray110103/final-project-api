// /dashboard/report/report.controller.ts
import { Request, Response } from "express";
import { ReportService } from "./report.service";
import { plainToInstance } from "class-transformer";
import { GetSalesReportDTO } from "./dto/get-sales-report.dto";
import { GetPropertyReportDTO } from "./dto/get-property-report.dto";

export class ReportController {
  private reportService: ReportService;
  
  constructor() {
    this.reportService = new ReportService();
  }

  getSalesReport = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const query = plainToInstance(GetSalesReportDTO, req.query);
    const result = await this.reportService.getSalesReport(query, authUserId);
    res.status(200).send(result);
  };

  getPropertyReport = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const query = plainToInstance(GetPropertyReportDTO, req.query);
    const result = await this.reportService.getPropertyReport(query, authUserId);
    res.status(200).send(result);
  };
}