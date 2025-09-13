import { Prisma } from "../../generated/prisma";
import { ApiError } from "../../utils/api-error";
import { generateSlug } from "../../utils/generate-slug";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePropertyDTO } from "./dto/create-property.dto";
import { GetPropertiesByTenantDTO } from "./dto/get-properties-by-tenant.dto";
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

  // Get properties and rooms by tenantId
  getPropertiesByTenant = async (tenantId: number, queryParams: GetPropertiesByTenantDTO) => {
    const { sortBy, sortOrder, take = 10, page = 1 } = queryParams; // Default values for pagination

    const whereClause: Prisma.PropertyWhereInput = {
      tenantId, // Fetch only properties belonging to the tenant
    };

    const properties = await this.prisma.property.findMany({
      where: whereClause,
      orderBy: {
        [sortBy || "createdAt"]: sortOrder || "asc", // Sort by createdAt if no other sortBy
      },
      skip: (page - 1) * take,
      take,
      include: {
        rooms: true, // Include rooms with the properties
        images: true, // Include property images
        facilities: true, // Include property facilities
      },
    });

    const total = await this.prisma.property.count({
      where: whereClause,
    });

    return {
      data: properties,
      meta: { page, take, total },
    };
  };

  getPropertyBySlug = async (slug: string) => {
    const property = await this.prisma.property.findFirst({
      where: { slug, deletedAt: null },
      include: {
        images: {
          select: { id: true, url: true },
        },
        facilities: {
          select: { id: true, title: true },
        },
        rooms: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            description: true,
            createdAt: true,
            images: {
              select: { id: true, url: true },
            },
          },
        },
        tenant: {
          select: {
            id: true,
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
    authUserId: number,
    images?: Express.Multer.File[] // multiple images
  ) => {
    const existing = await this.prisma.property.findFirst({
      where: { title: body.title },
    });

    if (existing) {
      throw new ApiError("Title already in use", 400);
    }

    const slug = generateSlug(body.title);
    const { secure_url } = await this.cloudinaryService.upload(thumbnail);

    // upload multiple images jika ada
    let uploadedImages: { url: string }[] = [];
    if (images && images.length > 0) {
      uploadedImages = await Promise.all(
        images.map(async (img) => {
          const { secure_url } = await this.cloudinaryService.upload(img);
          return { url: secure_url };
        })
      );
    }

    await this.prisma.property.create({
      data: {
        title: body.title,
        description: body.description,
        category: body.category,
        location: body.location,
        city: body.city,
        address: body.address,
        latitude: body.latitude,
        longtitude: body.longtitude,
        thumbnail: secure_url,
        tenantId: authUserId,
        slug,
        images: {
          create: uploadedImages, // ✅ simpan multiple images
        },
        facilities: {
          create: body.facilities?.map((f) => ({ title: f.title })) || [], // ✅ simpan fasilitas
        },
      },
    });

    return { message: "Create Property Success" };
  };
}
