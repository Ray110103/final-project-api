// /dashboard/report/report.service.ts
import { Prisma } from "../../generated/prisma";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { GetSalesReportDTO } from "./dto/get-sales-report.dto";
import { GetPropertyReportDTO } from "./dto/get-property-report.dto";

interface PropertySalesData {
  property: any; // Replace 'any' with your actual Property type if available
  totalSales: number;
  transactions: any[]; // Replace 'any' with your actual Transaction type if available
}

export class ReportService {
  private prisma: PrismaService;

  constructor() {
    this.prisma = new PrismaService();
  }

  getSalesReport = async (query: GetSalesReportDTO, authUserId: number) => {
    const { page, take, sortBy, sortOrder, startDate, endDate, propertyId } =
      query;

    // First, get properties owned by this tenant
    const tenantProperties = await this.prisma.property.findMany({
      where: { tenantId: authUserId },
      select: { id: true },
    });

    const propertyIds = tenantProperties.map((property) => property.id);

    const whereClause: Prisma.TransactionWhereInput = {
      room: {
        propertyId: {
          in: propertyIds,
        },
      },
      status: "PAID",
      ...(startDate &&
        endDate && {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      ...(propertyId && {
        room: {
          propertyId: parseInt(propertyId),
        },
      }),
    };

    const transactions = await this.prisma.transaction.findMany({
      include: {
        user: true,
        room: {
          include: {
            property: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * take,
      take: take,
      where: whereClause,
    });

    const total = await this.prisma.transaction.count({
      where: whereClause,
    });

    // Calculate total sales
    const totalSales = transactions.reduce(
      (sum, transaction) => sum + transaction.total,
      0
    );

    // Group by property if needed
    const salesByProperty: Record<number, PropertySalesData> = {};

    transactions.forEach((transaction) => {
      const propertyId = transaction.room.propertyId;
      if (!salesByProperty[propertyId]) {
        salesByProperty[propertyId] = {
          property: transaction.room.property,
          totalSales: 0,
          transactions: [],
        };
      }
      salesByProperty[propertyId].totalSales += transaction.total;
      salesByProperty[propertyId].transactions.push(transaction);
    });

    return {
      data: Object.values(salesByProperty),
      meta: { page, take, total, totalSales },
    };
  };

  getPropertyReport = async (
    query: GetPropertyReportDTO,
    authUserId: number
  ) => {
    const { propertyId, month } = query;

    // Get properties owned by this tenant
    const tenantProperties = await this.prisma.property.findMany({
      where: { tenantId: authUserId },
      include: {
        rooms: {
          include: {
            transactions: {
              where: {
                status: "PAID",
              },
            },
            roomNonAvailability: true,
          },
        },
      },
    });

    // Filter by specific property if requested
    const properties = propertyId
      ? tenantProperties.filter((p) => p.id === parseInt(propertyId))
      : tenantProperties;

    // Generate calendar view for each property
    const reportData = properties.map((property) => {
      const roomsData = property.rooms.map((room) => {
        // Get all dates for the month (or current month if not specified)
        const reportDate = month ? new Date(month) : new Date();
        const year = reportDate.getFullYear();
        const monthIndex = reportDate.getMonth();

        // Get all days in the month
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const calendar = [];

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, monthIndex, day);

          // Check if room is available on this date
          const isNonAvailable = room.roomNonAvailability.some(
            (na) => new Date(na.date).toDateString() === date.toDateString()
          );

          // Check if room is booked on this date
          const isBooked = room.transactions.some(
            (t) => new Date(t.startDate) <= date && new Date(t.endDate) >= date
          );

          calendar.push({
            date: date.toISOString().split("T")[0],
            available: !isNonAvailable && !isBooked,
            stock: room.stock,
            booked: isBooked,
          });
        }

        return {
          room,
          calendar,
        };
      });

      return {
        property,
        rooms: roomsData,
      };
    });

    return {
      data: reportData,
    };
  };
}
