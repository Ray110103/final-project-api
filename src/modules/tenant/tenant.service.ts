import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";

export class ProfileService {
  private prisma: PrismaService;

  constructor() {
    this.prisma = new PrismaService();
  }

  getTenantById = async (id: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        pictureProfile: true,
        role: true,
      },
    });

    if (!user || user.role !== "TENANT") {
      throw new ApiError("Tenant not found", 404);
    }

    return user;
  };
}
