import { Prisma } from "../../generated/prisma";
import { ApiError } from "../../utils/api-error";
import { generateSlug } from "../../utils/generate-slug";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePropertyDTO } from "./dto/create-property.dto";
import { GetPropertiesDTO } from "./dto/get-properties.dto";
import { UpdatePropertyDTO } from "./dto/update-property.dto";

export class PropertyService {
  private prisma: PrismaService;
  private cloudinaryService: CloudinaryService;

  constructor() {
    this.prisma = new PrismaService();
    this.cloudinaryService = new CloudinaryService();
  }

  // Fixed version with proper TypeScript types
  getProperties = async (query: GetPropertiesDTO) => {
    const {
      take,
      page,
      sortBy,
      sortOrder,
      search,
      category,
      location,
      city,
      checkInDate,
      checkOutDate,
      capacity,
      destination,
    } = query;

    console.log("=== PROPERTY SEARCH DEBUG ===");
    console.log("Query received:", query);

    // Date validation
    if (checkInDate && checkOutDate) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (checkIn >= checkOut) {
        throw new ApiError("Check-in date must be before check-out date", 400);
      }

      if (checkIn < today) {
        throw new ApiError("Check-in date cannot be in the past", 400);
      }
    }

    // Convert capacity dari string ke number jika ada
    const capacityNumber = capacity ? parseInt(capacity) : undefined;

    // Gunakan destination sebagai fallback untuk location
    const searchLocation = destination || location;

    console.log("Processed parameters:", {
      capacityNumber,
      searchLocation,
      destination,
      location,
    });

    const whereClause: Prisma.PropertyWhereInput = {
      deletedAt: null,
      status: "ACTIVE",
      ...(search && { title: { contains: search, mode: "insensitive" } }),
      ...(category && {
        category: {
          slug: category,
          deletedAt: null,
          isActive: true,
        },
      }),
      ...(city && {
        city: { contains: city, mode: "insensitive" },
      }),
    };

    // FIXED: Proper TypeScript typing for location search
    if (searchLocation) {
      console.log("Adding location search for:", searchLocation);

      // Split by comma and get all possible search terms
      const terms = searchLocation
        .toLowerCase()
        .split(",")
        .map((term) => term.trim())
        .filter((term) => term.length > 0);

      console.log("Search terms:", terms);

      // Create properly typed OR conditions
      const locationOrConditions: Prisma.PropertyWhereInput[] = [];

      // Add condition for each individual term
      terms.forEach((term) => {
        locationOrConditions.push({
          location: { contains: term, mode: "insensitive" as Prisma.QueryMode },
        });
        locationOrConditions.push({
          city: { contains: term, mode: "insensitive" as Prisma.QueryMode },
        });
      });

      // Also check the full string
      locationOrConditions.push({
        location: {
          contains: searchLocation,
          mode: "insensitive" as Prisma.QueryMode,
        },
      });
      locationOrConditions.push({
        city: {
          contains: searchLocation,
          mode: "insensitive" as Prisma.QueryMode,
        },
      });

      whereClause.OR = locationOrConditions;
    }

    console.log(
      "Where clause before room filtering:",
      JSON.stringify(whereClause, null, 2)
    );

    // Room filtering - only add if we have dates or capacity
    // Room filtering - simplified logic
    if (checkInDate && checkOutDate) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);

      console.log("Adding room availability filter for dates:", {
        checkIn,
        checkOut,
      });

      whereClause.rooms = {
        some: {
          // 1. Room must have sufficient capacity
          capacity: { gte: capacityNumber || 1 },

          // 2. Room must NOT have conflicting bookings
          NOT: {
            transactions: {
              some: {
                status: { in: ["PAID", "WAITING_FOR_CONFIRMATION"] },
                // Simple overlap check: booking period overlaps with requested period
                startDate: { lt: checkOut },
                endDate: { gt: checkIn },
              },
            },
          },
        },
      };
    } else if (capacityNumber) {
      // If only capacity filter (no dates)
      console.log("Adding capacity filter only:", capacityNumber);
      whereClause.rooms = {
        some: {
          capacity: { gte: capacityNumber },
        },
      };
    }

    console.log("Final where clause:", JSON.stringify(whereClause, null, 2));

    const properties = await this.prisma.property.findMany({
      where: whereClause,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * take,
      take: take,
      include: {
        rooms: {
          select: {
            id: true,
            name: true,
            price: true,
            capacity: true,
            stock: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
        images: {
          select: {
            id: true,
            url: true,
          },
        },
        facilities: {
          select: {
            id: true,
            title: true,
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

    const total = await this.prisma.property.count({ where: whereClause });

    console.log(
      `Final search found ${properties.length} properties, total: ${total}`
    );
    console.log(
      "Properties found:",
      properties.map((p) => ({
        id: p.id,
        title: p.title,
        location: p.location,
        city: p.city,
        roomCount: p.rooms.length,
      }))
    );
    console.log("=== END DEBUG ===");

    return {
      data: properties,
      meta: { page, take, total },
    };
  };

  getUniqueLocations = async () => {
    const result = await this.prisma.property.groupBy({
      by: ["city", "location"],
      where: {
        deletedAt: null,
        status: "ACTIVE",
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    });

    return result.map((item) => ({
      city: item.city,
      location: item.location,
      count: item._count.id,
    }));
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
            capacity: true, // Tambahkan capacity
            description: true,
            createdAt: true,
            images: {
              select: { id: true, url: true },
            },
            facilities: {
              // Tambahkan room facilities
              select: { id: true, title: true },
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
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
      },
    });

    if (!property) {
      throw new ApiError("Property not found", 404);
    }

    return property;
  };

  getPropertiesForTenant = async (
    tenantId: number,
    query: GetPropertiesDTO
  ) => {
    const {
      take,
      page,
      sortBy,
      sortOrder,
      search,
      category,
      location,
      city,
      checkInDate,
      checkOutDate,
      capacity,
      destination,
    } = query;

    // Convert capacity dan logic yang sama seperti getProperties
    const capacityNumber = capacity ? parseInt(capacity) : undefined;
    const searchLocation = destination || location;

    const whereClause: Prisma.PropertyWhereInput = {
      tenantId: tenantId,
      deletedAt: null,
      ...(search && { title: { contains: search, mode: "insensitive" } }),
      ...(category && {
        category: {
          slug: category,
          deletedAt: null,
          isActive: true,
        },
      }),
      ...(searchLocation && {
        OR: [
          { location: { contains: searchLocation, mode: "insensitive" } },
          { city: { contains: searchLocation, mode: "insensitive" } },
        ],
      }),
      ...(city && {
        city: { contains: city, mode: "insensitive" },
      }),
    };

    // Logic availability checking yang sama seperti getProperties
    // ... (copy logic dari getProperties untuk checkInDate/checkOutDate)

    const properties = await this.prisma.property.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take: take,
      include: {
        rooms: {
          select: {
            id: true,
            name: true,
            price: true,
            capacity: true,
            stock: true,
          },
        },
        category: { select: { id: true, name: true, slug: true } },
        images: { select: { id: true, url: true } },
        facilities: { select: { id: true, title: true } },
      },
    });

    const total = await this.prisma.property.count({ where: whereClause });

    return {
      data: properties,
      meta: { page, take, total },
    };
  };

  createProperty = async (
    body: CreatePropertyDTO,
    thumbnail: Express.Multer.File,
    authUserId: number,
    images?: Express.Multer.File[]
  ) => {
    const existing = await this.prisma.property.findFirst({
      where: { title: body.title },
    });

    if (existing) {
      throw new ApiError("Title already in use", 400);
    }

    // Validate categoryId if provided
    if (body.categoryId) {
      const categoryExists = await this.prisma.propertyCategory.findFirst({
        where: {
          id: body.categoryId,
          tenantId: authUserId,
          deletedAt: null,
          isActive: true,
        },
      });

      if (!categoryExists) {
        throw new ApiError("Invalid category or category not found", 400);
      }
    }

    const slug = generateSlug(body.title);
    const { secure_url } = await this.cloudinaryService.upload(thumbnail);

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
        categoryId: body.categoryId, // Use categoryId instead of category string
        location: body.location,
        city: body.city,
        address: body.address,
        latitude: body.latitude,
        longtitude: body.longtitude,
        thumbnail: secure_url,
        tenantId: authUserId,
        slug,
        images: {
          create: uploadedImages,
        },
        facilities: {
          create: body.facilities?.map((f) => ({ title: f.title })) || [],
        },
      },
    });

    return { message: "Create Property Success" };
  };

  updateProperty = async (
    slug: string,
    body: UpdatePropertyDTO,
    tenantId: number,
    thumbnail?: Express.Multer.File,
    images?: Express.Multer.File[]
  ) => {
    const existingProperty = await this.prisma.property.findFirst({
      where: {
        slug,
        deletedAt: null,
        tenantId,
      },
    });

    if (!existingProperty) {
      throw new ApiError(
        "Property not found or you don't have permission",
        404
      );
    }

    if (body.title && body.title !== existingProperty.title) {
      const titleExists = await this.prisma.property.findFirst({
        where: {
          title: body.title,
          id: { not: existingProperty.id },
        },
      });

      if (titleExists) {
        throw new ApiError("Title already in use", 400);
      }
    }

    // Validate categoryId if provided
    if (body.categoryId) {
      const categoryExists = await this.prisma.propertyCategory.findFirst({
        where: {
          id: body.categoryId,
          tenantId: tenantId,
          deletedAt: null,
          isActive: true,
        },
      });

      if (!categoryExists) {
        throw new ApiError("Invalid category or category not found", 400);
      }
    }

    const updateData: any = {};

    if (body.title) updateData.title = body.title;
    if (body.description) updateData.description = body.description;
    if (body.categoryId) updateData.categoryId = body.categoryId; // Use categoryId
    if (body.location) updateData.location = body.location;
    if (body.city) updateData.city = body.city;
    if (body.address) updateData.address = body.address;
    if (body.latitude) updateData.latitude = body.latitude;
    if (body.longtitude) updateData.longtitude = body.longtitude;

    if (body.title) {
      updateData.slug = generateSlug(body.title);
    }

    if (thumbnail) {
      const { secure_url } = await this.cloudinaryService.upload(thumbnail);
      updateData.thumbnail = secure_url;
    }

    if (body.facilities) {
      await this.prisma.propertyFacility.deleteMany({
        where: { propertyId: existingProperty.id },
      });
    }

    let uploadedImages: { url: string }[] = [];
    if (images && images.length > 0) {
      uploadedImages = await Promise.all(
        images.map(async (img) => {
          const { secure_url } = await this.cloudinaryService.upload(img);
          return { url: secure_url };
        })
      );
    }

    await this.prisma.property.update({
      where: { id: existingProperty.id },
      data: {
        ...updateData,
        ...(body.facilities && {
          facilities: {
            create: body.facilities.map((f) => ({ title: f.title })),
          },
        }),
        ...(uploadedImages.length > 0 && {
          images: {
            create: uploadedImages,
          },
        }),
      },
    });

    return {
      message: "Property updated successfully",
      slug: updateData.slug || slug,
    };
  };

  deleteProperty = async (slug: string) => {
    const property = await this.prisma.property.findFirst({
      where: { slug, deletedAt: null },
    });

    if (!property) {
      throw new ApiError("Property not found", 404);
    }

    await this.prisma.property.update({
      where: { slug },
      data: {
        deletedAt: new Date(),
      },
    });

    return { message: "Property deleted successfully" };
  };

  getCategoriesForTenant = async (tenantId: number) => {
    return this.prisma.propertyCategory.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            properties: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  };

  createCategory = async (
    body: { name: string; description?: string; isActive?: boolean },
    tenantId: number
  ) => {
    const slug = generateSlug(body.name);

    const existing = await this.prisma.propertyCategory.findFirst({
      where: { slug, tenantId, deletedAt: null },
    });

    if (existing) {
      throw new ApiError("Category name already exists", 400);
    }

    return this.prisma.propertyCategory.create({
      data: {
        name: body.name,
        slug,
        isActive: body.isActive ?? true,
        tenantId,
      },
    });
  };

  updateCategory = async (
    slug: string,
    body: { name?: string; isActive?: boolean },
    tenantId: number
  ) => {
    const category = await this.prisma.propertyCategory.findFirst({
      where: { slug, tenantId, deletedAt: null },
    });

    if (!category) {
      throw new ApiError("Category not found", 404);
    }

    const updateData: any = {};
    if (body.name) {
      // Check if new name would create duplicate slug
      const newSlug = generateSlug(body.name);
      if (newSlug !== slug) {
        const existingWithNewSlug =
          await this.prisma.propertyCategory.findFirst({
            where: { slug: newSlug, tenantId, deletedAt: null },
          });

        if (existingWithNewSlug) {
          throw new ApiError("Category name already exists", 400);
        }
      }

      updateData.name = body.name;
      updateData.slug = newSlug;
    }
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    return this.prisma.propertyCategory.update({
      where: { id: category.id }, // Still use ID for the actual update
      data: updateData,
    });
  };

  deleteCategory = async (slug: string, tenantId: number) => {
    const category = await this.prisma.propertyCategory.findFirst({
      where: { slug, tenantId, deletedAt: null },
    });

    if (!category) {
      throw new ApiError("Category not found", 404);
    }

    const propertiesUsingCategory = await this.prisma.property.count({
      where: { categoryId: category.id, deletedAt: null },
    });

    if (propertiesUsingCategory > 0) {
      throw new ApiError(
        "Cannot delete category that is being used by properties",
        400
      );
    }

    return this.prisma.propertyCategory.update({
      where: { id: category.id }, // Still use ID for the actual update
      data: { deletedAt: new Date() },
    });
  };

  // Method untuk check availability specific room
  checkRoomAvailability = async (
    roomId: number,
    checkInDate: string,
    checkOutDate: string
  ): Promise<boolean> => {
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Cek apakah ada booking yang conflict
    const conflictingBookings = await this.prisma.transaction.count({
      where: {
        roomId: roomId,
        status: {
          in: ["PAID", "WAITING_FOR_CONFIRMATION", "WAITING_FOR_PAYMENT"],
        },
        startDate: { lt: checkOut },
        endDate: { gt: checkIn },
      },
    });

    // Cek apakah ada non-availability dates
    const nonAvailableDates = await this.prisma.roomNonAvailability.count({
      where: {
        roomId: roomId,
        date: {
          gte: checkIn,
          lt: checkOut,
        },
      },
    });

    return conflictingBookings === 0 && nonAvailableDates === 0;
  };

  // Method untuk get available rooms dalam property dengan dates
  getAvailableRoomsForProperty = async (
    propertyId: number,
    checkInDate: string,
    checkOutDate: string,
    capacity?: number
  ) => {
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    return await this.prisma.room.findMany({
      where: {
        propertyId: propertyId,
        ...(capacity && { capacity: { gte: capacity } }),
        // Room tidak boleh ada booking yang conflict
        NOT: {
          AND: [
            {
              transactions: {
                some: {
                  status: {
                    in: [
                      "PAID",
                      "WAITING_FOR_CONFIRMATION",
                      "WAITING_FOR_PAYMENT",
                    ],
                  },
                  startDate: { lt: checkOut },
                  endDate: { gt: checkIn },
                },
              },
            },
            {
              roomNonAvailability: {
                some: {
                  date: {
                    gte: checkIn,
                    lt: checkOut,
                  },
                },
              },
            },
          ],
        },
      },
      include: {
        images: { select: { id: true, url: true } },
        facilities: { select: { id: true, title: true } },
      },
    });
  };

  // Method untuk get property dengan room availability info
  getPropertyWithAvailability = async (
    slug: string,
    checkInDate?: string,
    checkOutDate?: string,
    capacity?: number
  ) => {
    const property = await this.getPropertyBySlug(slug);

    if (checkInDate && checkOutDate && property.rooms) {
      // Add availability info to each room
      const roomsWithAvailability = await Promise.all(
        property.rooms.map(async (room) => {
          const isAvailable = await this.checkRoomAvailability(
            room.id,
            checkInDate,
            checkOutDate
          );

          const meetsCapacity = capacity ? room.capacity >= capacity : true;

          return {
            ...room,
            isAvailable: isAvailable && meetsCapacity,
            availabilityChecked: true,
          };
        })
      );

      return {
        ...property,
        rooms: roomsWithAvailability,
        hasAvailableRooms: roomsWithAvailability.some(
          (room) => room.isAvailable
        ),
      };
    }

    return property;
  };
}
