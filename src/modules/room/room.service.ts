import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";
import { CreateRoomsDTO } from "./dto/create-room.dto";
import { GetRoomsDTO } from "./dto/get-room.dto";
import { Prisma } from "@prisma/client";

export class RoomService {
  private prisma: PrismaService;

  constructor() {
    this.prisma = new PrismaService();
  }

  // ✅ GET ROOMS
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

    // If property is provided, validate it exists and get its ID
    if (property) {
      const isNumeric = !isNaN(Number(property));

      if (isNumeric) {
        whereClause.propertyId = Number(property);
      } else {
        const propertyData = await this.prisma.property.findFirst({
          where: { slug: property },
          select: { id: true },
        });

        if (!propertyData) {
          throw new ApiError("Property not found", 404);
        }

        whereClause.propertyId = propertyData.id;
      }
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
            tenant: true,
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

  // ✅ CREATE ROOM
  createRoom = async (body: CreateRoomsDTO, userId: number) => {
  const price = parseInt(body.price as any, 10);
  const limit = parseInt(body.limit as any, 10);

  if (isNaN(price) || isNaN(limit)) {
    throw new ApiError("Invalid price or limit format", 400);
  }

  // Accept either numeric id or slug in body.property
  const maybeId = Number(body.property);
  let property;

  if (!isNaN(maybeId)) {
    property = await this.prisma.property.findFirst({
      where: {
        id: maybeId,
        OR: [{ tenantId: userId }],
      },
    });
  } else {
    property = await this.prisma.property.findFirst({
      where: {
        slug: body.property,
        OR: [{ tenantId: userId }],
      },
    });
  }

  if (!property) {
    throw new ApiError("Property not found or you do not have access", 404);
  }

  const room = await this.prisma.room.create({
    data: {
      name: body.name,
      stock: limit,
      price, // ✅ langsung number (Int)
      description: body.description,
      propertyId: property.id,
    },
    include: {
      property: {
        select: { id: true, title: true, slug: true },
      },
    },
  });

  return {
    message: "Room created successfully",
    data: room,
  };
};
}
