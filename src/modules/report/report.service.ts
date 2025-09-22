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
    const { page, take, sortBy, sortOrder, startDate, endDate, propertyId, groupBy } =
      query;

    // Ensure the authenticated user (tenant) only sees their properties' transactions
    const tenantProperties = await this.prisma.property.findMany({
      where: { tenantId: authUserId },
      select: { id: true },
    });

    const propertyIds = tenantProperties.map((p) => p.id);

    const whereClause: Prisma.TransactionWhereInput = {
      room: {
        propertyId: { in: propertyIds },
      },
      status: "PAID",
      ...(startDate && endDate
        ? { createdAt: { gte: startDate, lte: endDate } }
        : {}),
      ...(propertyId
        ? {
            room: {
              propertyId: parseInt(propertyId),
            },
          }
        : {}),
    };

    // Map report sortBy to Prisma orderBy for transaction list queries
    const txOrderBy: any =
      sortBy === "total"
        ? { total: sortOrder }
        : { createdAt: sortOrder };

    if (groupBy === "transaction") {
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          include: { user: true, room: { include: { property: true } } },
          orderBy: txOrderBy,
          skip: (page - 1) * take,
          take,
          where: whereClause,
        }),
        this.prisma.transaction.count({ where: whereClause }),
      ]);

      const grandTotalSales = await this.prisma.transaction.aggregate({
        _sum: { total: true },
        where: whereClause,
      });

      return {
        data: transactions,
        meta: {
          page,
          take,
          total,
          grandTotalSales: grandTotalSales._sum.total || 0,
        },
      };
    }

    // Load all filtered transactions for grouping (property or user)
    const allTransactions = await this.prisma.transaction.findMany({
      include: { user: true, room: { include: { property: true } } },
      where: whereClause,
    });

    const grandTotalSales = allTransactions.reduce((sum, t) => sum + t.total, 0);

    if (groupBy === "user") {
      const byUser: Record<
        number,
        { user: any; totalSales: number; latestDate: Date | null; transactions: any[] }
      > = {};

      for (const t of allTransactions) {
        const key = t.userId;
        if (!byUser[key]) {
          byUser[key] = {
            user: t.user,
            totalSales: 0,
            latestDate: null,
            transactions: [],
          };
        }
        byUser[key].totalSales += t.total;
        byUser[key].latestDate = byUser[key].latestDate
          ? new Date(Math.max(byUser[key].latestDate.getTime(), t.createdAt.getTime()))
          : t.createdAt;
        byUser[key].transactions.push(t);
      }

      let groups = Object.values(byUser);
      // Sort groups by requested sortBy
      if (sortBy === "total") {
        groups.sort((a, b) =>
          sortOrder === "asc" ? a.totalSales - b.totalSales : b.totalSales - a.totalSales
        );
      } else {
        groups.sort((a, b) => {
          const aTime = a.latestDate ? a.latestDate.getTime() : 0;
          const bTime = b.latestDate ? b.latestDate.getTime() : 0;
          return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
        });
      }

      const totalGroups = groups.length;
      const paged = groups.slice((page - 1) * take, (page - 1) * take + take);
      return {
        data: paged,
        meta: { page, take, total: totalGroups, grandTotalSales },
      };
    }

    // Default: groupBy property
    const byProperty: Record<
      number,
      { property: any; totalSales: number; latestDate: Date | null; transactions: any[] }
    > = {};

    for (const t of allTransactions) {
      const key = t.room.propertyId;
      if (!byProperty[key]) {
        byProperty[key] = {
          property: t.room.property,
          totalSales: 0,
          latestDate: null,
          transactions: [],
        };
      }
      byProperty[key].totalSales += t.total;
      byProperty[key].latestDate = byProperty[key].latestDate
        ? new Date(
            Math.max(byProperty[key].latestDate.getTime(), t.createdAt.getTime())
          )
        : t.createdAt;
      byProperty[key].transactions.push(t);
    }

    let groups = Object.values(byProperty);
    if (sortBy === "total") {
      groups.sort((a, b) =>
        sortOrder === "asc" ? a.totalSales - b.totalSales : b.totalSales - a.totalSales
      );
    } else {
      groups.sort((a, b) => {
        const aTime = a.latestDate ? a.latestDate.getTime() : 0;
        const bTime = b.latestDate ? b.latestDate.getTime() : 0;
        return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
      });
    }

    const totalGroups = groups.length;
    const paged = groups.slice((page - 1) * take, (page - 1) * take + take);
    return { data: paged, meta: { page, take, total: totalGroups, grandTotalSales } };
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
        const calendar = [] as Array<{
          date: string;
          available: boolean;
          stock: number;
          booked: boolean;
          bookedUnits: number;
          availableUnits: number;
        }>;

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, monthIndex, day);

          // Check if room is available on this date
          const isNonAvailable = room.roomNonAvailability.some(
            (na) => new Date(na.date).toDateString() === date.toDateString()
          );

          // Sum booked units (qty) on this date across overlapping transactions
          const bookedUnits = room.transactions
            .filter(
              (t) => new Date(t.startDate) <= date && new Date(t.endDate) >= date
            )
            .reduce((sum, t) => sum + t.qty, 0);

          const availableUnits = Math.max(isNonAvailable ? 0 : room.stock - bookedUnits, 0);
          const isBooked = bookedUnits > 0;

          calendar.push({
            date: date.toISOString().split("T")[0],
            available: !isNonAvailable && !isBooked,
            stock: room.stock,
            booked: isBooked,
            bookedUnits,
            availableUnits,
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
