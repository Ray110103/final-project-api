import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";
import { CreateRoomsDTO } from "./dto/create-room.dto";
import { GetRoomsDTO } from "./dto/get-room.dto";
import { CloudinaryService } from "../cloudinary/cloudinary.service";

export class RoomService {
  private prisma: PrismaService;
  private cloudinaryService: CloudinaryService;

  constructor() {
    this.prisma = new PrismaService();
    this.cloudinaryService = new CloudinaryService();
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
        images: true,
      },
    });

    const total = await this.prisma.room.count({ where: whereClause });

    return {
      data: rooms,
      meta: { page: Number(page), take: Number(take), total },
    };
  };

  // ✅ CREATE ROOM (with multiple images)
  createRoom = async (
    body: CreateRoomsDTO,
    userId: number,
    images: Express.Multer.File[]
  ) => {
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
          tenantId: userId,
        },
      });
    } else {
      property = await this.prisma.property.findFirst({
        where: {
          slug: body.property,
          tenantId: userId,
        },
      });
    }

    if (!property) {
      throw new ApiError("Property not found or you do not have access", 404);
    }

    // ✅ Upload images to Cloudinary
    let uploadedImages: { secure_url: string }[] = [];
    if (images && images.length > 0) {
      uploadedImages = await Promise.all(
        images.map((file) => this.cloudinaryService.upload(file))
      );
    }

    // ✅ Create room and save uploaded images
    const room = await this.prisma.room.create({
      data: {
        name: body.name,
        stock: limit,
        price,
        description: body.description,
        propertyId: property.id,
        images: {
          create: uploadedImages.map((img) => ({ url: img.secure_url })),
        },
      },
      include: {
        property: { select: { id: true, title: true, slug: true } },
        images: true,
      },
    });

    return {
      message: "Room created successfully",
      data: room,
    };
  };
}
