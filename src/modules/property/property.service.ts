import { Prisma } from "../../generated/prisma";
import { ApiError } from "../../utils/api-error";
import { generateSlug } from "../../utils/generate-slug";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePropertyDTO } from "./dto/create-property.dto";
import { GetPropertiesDTO } from "./dto/get-property.dto";

export class PropertyService {
  private prisma: PrismaService;
  private cloudinaryService: CloudinaryService;

  constructor() {
    this.prisma = new PrismaService();
    this.cloudinaryService = new CloudinaryService();
  }

  getProperties = async (query: GetPropertiesDTO) => {
    const { take, page, sortBy, sortOrder, search, category, location } = query;

    const whereClause: Prisma.PropertyWhereInput = {
      deletedAt: null,
      ...(search && { title: { contains: search, mode: "insensitive" } }),
      ...(category && { category }),
      ...(location && { location: { contains: location, mode: "insensitive" } }),
    };

    const properties = await this.prisma.property.findMany({
      where: whereClause,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * take,
      take: take,
      include: {
        rooms: {
          select: { price: true },
        },
      },
    });

    const total = await this.prisma.property.count({ where: whereClause });

    return {
      data: properties,
      meta: { page, take, total },
    };
  };

  getPropertyBySlug = async (slug: string) => {
    const property = await this.prisma.property.findFirst({
      where: { slug, deletedAt: null },
      include: {
        rooms: true,
        tenant: {
          select: {
            name: true,
            pictureProfile: true,
          },
        },
      },
    });

    if (!property) {
      throw new ApiError("Property not found", 404);
    }
    return property;
  };

  createProperty = async (
    body: CreatePropertyDTO,
    thumbnail: Express.Multer.File,
    authUserId: number
  ) => {
    const existing = await this.prisma.property.findFirst({
      where: { title: body.title },
    });

    if (existing) {
      throw new ApiError("Title already in use", 400);
    }

    const slug = generateSlug(body.title);
    const { secure_url } = await this.cloudinaryService.upload(thumbnail);

    // await this.prisma.property.create({
    //   data: {
    //     title: body.title,
    //     description: body.description,
    //     category: body.category,
    //     location: body.location,
    //     city: body.city,
    //     address: body.address,
    //     latitude: body.latitude,
    //     longtitude: body.longtitude,
    //     thumbnail: secure_url,
    //     tenantId: authUserId,
    //     slug,
    //   },
    // });

    return {message: "Create Property Success"};
  };
}
