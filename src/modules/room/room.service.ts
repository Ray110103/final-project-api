import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";
import { CreateRoomsDTO } from "./dto/create-room.dto";
import { GetRoomsDTO } from "./dto/get-room.dto";

export class RoomService {
  private prisma: PrismaService;

  constructor() {
    this.prisma = new PrismaService();
  }

  getRooms = async (query: GetRoomsDTO) => {
    const {
      take = 10,
      page = 1,
      sortBy = "createdAt",
      sortOrder = "desc",
      property,
      name,
    } = query;

    const whereClause: any = {};

    if (property) {
      whereClause.propertyId = Number(property);
    }

    if (name) {
      whereClause.name = {
        contains: name,
        mode: "insensitive",
      };
    }

    const rooms = await this.prisma.room.findMany({
      where: whereClause,
      orderBy: { [sortBy]: sortOrder },
      skip: (Number(page) - 1) * Number(take),
      take: Number(take),
      include: {
        property: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            location: true,
            category: true,
            createdAt: true,
            updatedAt: true,
            tenantId: true,
          },
        },
      },
    });

    const total = await this.prisma.room.count({ where: whereClause });

    return {
      data: rooms,
      meta: { page: Number(page), take: Number(take), total },
    };
  };

  createRoom = async (body: CreateRoomsDTO, userId: number) => {
    const propertyId = Number(body.property);
    const price = Number(body.price);
    const limit = Number(body.limit);

    if (isNaN(propertyId) || isNaN(price) || isNaN(limit)) {
      throw new ApiError("Invalid propertyId, price, or stock format", 400);
    }

    // Validate property ownership
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId: userId },
    });

    if (!property) {
      throw new ApiError("Property not found or you do not have access", 404);
    }

    const room = await this.prisma.room.create({
      data: {
        name: body.name,
        stock: limit,
        price,
        propertyId,
      },
    });

    return {
      message: "Room created successfully",
      data: room,
    };
  };
}
