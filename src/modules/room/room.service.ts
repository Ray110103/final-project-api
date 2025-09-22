import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../../utils/api-error";
import { CreateRoomsDTO } from "./dto/create-room.dto";
import { GetRoomsDTO } from "./dto/get-room.dto";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { CreateSeasonalRateDTO } from "./dto/create-seasonal-rate.dto";
import { GetSeasonalRatesDTO } from "./dto/get-seasonal-rates.dto";
import { UpdateSeasonalRateDTO } from "./dto/update-seasonal-rate.dto";

export class RoomService {
  private prisma: PrismaService;
  private cloudinaryService: CloudinaryService;

  constructor() {
    this.prisma = new PrismaService();
    this.cloudinaryService = new CloudinaryService();
  }

  // Existing methods... (getRooms, getRoomsByPropertySlug, markRoomAsUnavailable)

  // Debug version of getRooms method
  // Fixed getRooms method - add trim() to clean parameters
  getRooms = async (query: GetRoomsDTO) => {
    const {
      take = "10",
      page = "1",
      sortBy = "createdAt",
      sortOrder = "desc",
      property,
      name,
      destination,
      checkInDate,
      checkOutDate,
      capacity,
    } = query;

    const whereClause: any = {};
    console.log("Initial whereClause:", whereClause);

    // Property filter (by id or slug)
    if (property) {
      console.log("Applying property filter:", property);
      const cleanProperty = property.toString().trim(); // TRIM added
      const isNumeric = !isNaN(Number(cleanProperty));

      if (isNumeric) {
        whereClause.propertyId = Number(cleanProperty);
      } else {
        const propertyData = await this.prisma.property.findFirst({
          where: { slug: cleanProperty },
          select: { id: true },
        });

        if (!propertyData) {
          throw new ApiError("Property not found", 404);
        }

        whereClause.propertyId = propertyData.id;
      }
      console.log("After property filter:", whereClause);
    }

    // Name filter
    if (name) {
      console.log("Applying name filter:", name);
      const cleanName = name.toString().trim(); // TRIM added
      whereClause.name = {
        contains: cleanName,
        mode: "insensitive",
      };
      console.log("After name filter:", whereClause);
    }

    // Destination filter (city or location) - FIXED with trim
    if (destination) {
      console.log("Applying destination filter:", destination);
      const cleanDestination = destination.toString().trim(); // TRIM added
      console.log("Cleaned destination:", cleanDestination);

      // Don't override existing property filter
      if (whereClause.property) {
        whereClause.AND = whereClause.AND || [];
        whereClause.AND.push({
          property: {
            OR: [
              { city: { contains: cleanDestination, mode: "insensitive" } },
              { location: { contains: cleanDestination, mode: "insensitive" } },
            ],
          },
        });
      } else {
        whereClause.property = {
          OR: [
            { city: { contains: cleanDestination, mode: "insensitive" } },
            { location: { contains: cleanDestination, mode: "insensitive" } },
          ],
        };
      }
      console.log(
        "After destination filter:",
        JSON.stringify(whereClause, null, 2)
      );
    }

    // Capacity filter (room capacity >= requested guest capacity)
    if (capacity) {
      console.log("Applying capacity filter:", capacity);
      whereClause.capacity = {
        gte: Number(capacity),
      };
      console.log("After capacity filter:", whereClause);
    }

    // Availability filter
    if (checkInDate && checkOutDate) {
      console.log("Applying availability filter");
      const cleanCheckIn = checkInDate.toString().trim(); // TRIM added
      const cleanCheckOut = checkOutDate.toString().trim(); // TRIM added

      const checkIn = new Date(cleanCheckIn);
      const checkOut = new Date(cleanCheckOut);

      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
        throw new ApiError("Invalid check-in or check-out date", 400);
      }

      console.log("Filtering availability for dates:", { checkIn, checkOut });

      if (!whereClause.AND) {
        whereClause.AND = [];
      }

      // Room must have stock > 0
      whereClause.AND.push({
        stock: {
          gt: 0,
        },
      });

      // Room should NOT have non-availability records that overlap with search dates
      whereClause.AND.push({
        NOT: {
          roomNonAvailability: {
            some: {
              date: {
                gte: checkIn,
                lt: checkOut,
              },
            },
          },
        },
      });

      // Room should NOT have confirmed bookings that overlap with search dates
      whereClause.AND.push({
        NOT: {
          transactions: {
            some: {
              AND: [
                {
                  OR: [
                    {
                      AND: [
                        { startDate: { lt: checkOut } },
                        { endDate: { gt: checkIn } },
                      ],
                    },
                  ],
                },
                {
                  status: { in: ["PAID", "WAITING_FOR_CONFIRMATION"] },
                },
              ],
            },
          },
        },
      });

      console.log(
        "After availability filter:",
        JSON.stringify(whereClause, null, 2)
      );
    }

    console.log("=== FINAL WHERE CLAUSE ===");
    console.log(JSON.stringify(whereClause, null, 2));

    const totalRooms = await this.prisma.room.count();
    console.log("Total rooms in database:", totalRooms);

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
            city: true,
            category: true,
            createdAt: true,
            updatedAt: true,
            tenantId: true,
            tenant: true,
          },
        },
        images: true,
        facilities: {
          select: {
            id: true,
            title: true,
          },
        },
        roomNonAvailability: {
          select: {
            id: true,
            date: true,
            reason: true,
          },
        },
      },
    });

    console.log(`Query returned ${rooms.length} rooms`);

    rooms.forEach((room) => {
      if (room.roomNonAvailability.length > 0) {
        console.log(`  Non-availability:`, room.roomNonAvailability);
      }
    });

    const total = await this.prisma.room.count({ where: whereClause });
    console.log("Total count with filter:", total);

    console.log("=== END DEBUGGING ===");

    return {
      data: rooms,
      meta: { page: Number(page), take: Number(take), total },
    };
  };

  // Updated method in RoomService
  getRoomsByPropertySlug = async (slug: string) => {
    try {
      // First verify property exists
      const property = await this.prisma.property.findFirst({
        where: { slug: slug },
        select: { id: true, title: true, slug: true, tenantId: true },
      });

      if (!property) {
        throw new ApiError("Property not found", 404);
      }

      // Get rooms for this property
      const rooms = await this.prisma.room.findMany({
        where: {
          property: {
            slug: slug,
          },
        },
        include: {
          property: true,
          images: true,
          facilities: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      // Always return rooms array (empty or with data)
      return rooms;
    } catch (error) {
      console.error("Error fetching rooms:", error);
      throw error;
    }
  };

  markRoomAsUnavailable = async (
    roomId: number,
    date: Date,
    reason: string,
    userId: number // Tambahkan parameter userId
  ) => {
    console.log("Checking if room is available", roomId, date);

    // TAMBAHKAN: Verifikasi ownership room
    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        property: {
          tenantId: userId, // Pastikan room ini milik tenant yang login
        },
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            tenantId: true,
          },
        },
      },
    });

    if (!room) {
      throw new ApiError(
        "Room not found or you don't have access to this room",
        404
      );
    }

    const existingNonAvailability =
      await this.prisma.roomNonAvailability.findFirst({
        where: {
          roomId,
          date,
        },
      });

    if (existingNonAvailability) {
      console.log(
        "Room already marked as unavailable",
        existingNonAvailability
      );
      throw new ApiError(
        "Room is already marked as unavailable on this date",
        400
      );
    }

    console.log("Marking room as unavailable", roomId, date, reason);

    const newNonAvailability = await this.prisma.roomNonAvailability.create({
      data: {
        roomId,
        date,
        reason,
      },
    });

    console.log("Non-availability marked", newNonAvailability);
    return {
      message: "Room marked as unavailable successfully",
      data: newNonAvailability,
    };
  };

  createRoom = async (
    body: CreateRoomsDTO,
    userId: number,
    images: Express.Multer.File[]
  ) => {
    // Parse string values to numbers
    const price = parseInt(body.price, 10);
    const limit = parseInt(body.limit, 10);
    const capacity = parseInt(body.capacity, 10);

    if (isNaN(price) || isNaN(limit) || isNaN(capacity)) {
      throw new ApiError("Invalid price, limit, or capacity format", 400);
    }

    if (capacity <= 0) {
      throw new ApiError("Capacity must be greater than 0", 400);
    }

    if (limit <= 0) {
      throw new ApiError("Room stock must be greater than 0", 400);
    }

    // Verify property ownership
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

    // Upload images to Cloudinary
    let uploadedImages: { secure_url: string }[] = [];
    if (images && images.length > 0) {
      uploadedImages = await Promise.all(
        images.map((file) => this.cloudinaryService.upload(file))
      );
    }

    // Create room with facilities
    const room = await this.prisma.room.create({
      data: {
        name: body.name,
        stock: limit,
        capacity: capacity,
        price,
        description: body.description,
        propertyId: property.id,
        images: {
          create: uploadedImages.map((img) => ({ url: img.secure_url })),
        },
        facilities: {
          create: body.facilities?.map((f) => ({ title: f.title })) || [],
        },
      },
      include: {
        property: { select: { id: true, title: true, slug: true } },
        images: true,
        facilities: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return {
      message: "Room created successfully",
      data: room,
    };
  };

  updateRoom = async (
    roomId: number,
    body: Partial<CreateRoomsDTO>,
    userId: number,
    images?: Express.Multer.File[]
  ) => {
    // Verify room ownership
    const existingRoom = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        property: {
          tenantId: userId,
        },
      },
      include: {
        property: { select: { id: true, title: true, tenantId: true } },
      },
    });

    if (!existingRoom) {
      throw new ApiError("Room not found or you don't have access", 404);
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name) {
      updateData.name = body.name;
    }

    if (body.description) {
      updateData.description = body.description;
    }

    if (body.capacity) {
      const capacity = parseInt(body.capacity, 10);
      if (isNaN(capacity) || capacity <= 0) {
        throw new ApiError("Invalid capacity value", 400);
      }
      updateData.capacity = capacity;
    }

    if (body.limit) {
      const limit = parseInt(body.limit, 10);
      if (isNaN(limit) || limit <= 0) {
        throw new ApiError("Invalid stock value", 400);
      }
      updateData.stock = limit;
    }

    if (body.price) {
      const price = parseInt(body.price, 10);
      if (isNaN(price) || price < 0) {
        throw new ApiError("Invalid price value", 400);
      }
      updateData.price = price;
    }

    // Handle property change (optional)
    if (
      body.property &&
      body.property !== existingRoom.property.id.toString()
    ) {
      const maybeId = Number(body.property);
      let newProperty;

      if (!isNaN(maybeId)) {
        newProperty = await this.prisma.property.findFirst({
          where: {
            id: maybeId,
            tenantId: userId,
          },
        });
      } else {
        newProperty = await this.prisma.property.findFirst({
          where: {
            slug: body.property,
            tenantId: userId,
          },
        });
      }

      if (!newProperty) {
        throw new ApiError(
          "New property not found or you don't have access",
          404
        );
      }

      updateData.propertyId = newProperty.id;
    }

    // Handle image uploads
    let uploadedImages: { secure_url: string }[] = [];
    if (images && images.length > 0) {
      uploadedImages = await Promise.all(
        images.map((file) => this.cloudinaryService.upload(file))
      );
    }

    // Handle facilities update
    if (body.facilities) {
      // Delete existing facilities first
      await this.prisma.roomFacility.deleteMany({
        where: { roomId: roomId },
      });
    }

    // Update room
    const updatedRoom = await this.prisma.room.update({
      where: { id: roomId },
      data: {
        ...updateData,
        ...(uploadedImages.length > 0 && {
          images: {
            create: uploadedImages.map((img) => ({ url: img.secure_url })),
          },
        }),
        ...(body.facilities && {
          facilities: {
            create: body.facilities.map((f) => ({ title: f.title })),
          },
        }),
      },
      include: {
        property: { select: { id: true, title: true, slug: true } },
        images: true,
        facilities: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return {
      message: "Room updated successfully",
      data: updatedRoom,
    };
  };

  deleteRoom = async (roomId: number, userId: number) => {
    // Verify room ownership
    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        property: {
          tenantId: userId,
        },
      },
      include: {
        _count: {
          select: {
            transactions: {
              where: {
                status: {
                  in: [
                    "PAID",
                    "WAITING_FOR_CONFIRMATION",
                    "WAITING_FOR_PAYMENT",
                  ],
                },
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new ApiError("Room not found or you don't have access", 404);
    }

    // Check for active bookings
    if (room._count.transactions > 0) {
      throw new ApiError(
        "Cannot delete room with active or pending bookings. Please wait for all bookings to complete or cancel them first.",
        400
      );
    }

    // Check for future bookings
    const futureBookings = await this.prisma.transaction.count({
      where: {
        roomId: roomId,
        startDate: { gte: new Date() },
        status: { in: ["PAID", "WAITING_FOR_CONFIRMATION"] },
      },
    });

    if (futureBookings > 0) {
      throw new ApiError(
        "Cannot delete room with future bookings. Please cancel or complete all future bookings first.",
        400
      );
    }

    // Delete related data first (cascade delete might not be set up)
    await Promise.all([
      this.prisma.roomFacility.deleteMany({ where: { roomId } }),
      this.prisma.roomImage.deleteMany({ where: { roomId } }),
      this.prisma.roomNonAvailability.deleteMany({ where: { roomId } }),
      this.prisma.seasonalRate.deleteMany({ where: { roomId } }),
    ]);

    // Delete the room
    await this.prisma.room.delete({
      where: { id: roomId },
    });

    return {
      message: "Room deleted successfully",
    };
  };

  getRoomById = async (roomId: number, userId?: number) => {
    const whereClause: any = { id: roomId };

    // If userId provided, ensure ownership
    if (userId) {
      whereClause.property = {
        tenantId: userId,
      };
    }

    const room = await this.prisma.room.findFirst({
      where: whereClause,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            slug: true,
            tenantId: true,
          },
        },
        images: true,
        facilities: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!room) {
      throw new ApiError(
        userId ? "Room not found or you don't have access" : "Room not found",
        404
      );
    }

    return room;
  };

  getTenantRooms = async (query: GetRoomsDTO, userId: number) => {
    console.log("=== FETCHING TENANT ROOMS ===");
    console.log("Tenant ID:", userId);
    console.log("Query:", query);

    const {
      take = "10",
      page = "1",
      sortBy = "createdAt",
      sortOrder = "desc",
      property,
      name,
      checkInDate,
      checkOutDate,
      capacity,
    } = query;

    const whereClause: any = {
      // SECURITY: Always filter by tenant ownership
      property: {
        tenantId: userId,
      },
    };

    console.log("Base security filter applied:", whereClause);

    // Property filter (by id or slug) - within tenant's properties only
    if (property) {
      console.log("Applying property filter:", property);
      const cleanProperty = property.toString().trim();
      const isNumeric = !isNaN(Number(cleanProperty));

      if (isNumeric) {
        // Update the existing property filter to include both tenantId and propertyId
        whereClause.AND = [
          { property: { tenantId: userId } },
          { propertyId: Number(cleanProperty) },
        ];
      } else {
        // Find property by slug within tenant's properties
        const propertyData = await this.prisma.property.findFirst({
          where: {
            slug: cleanProperty,
            tenantId: userId, // SECURITY: Only search within tenant's properties
          },
          select: { id: true },
        });

        if (!propertyData) {
          throw new ApiError(
            "Property not found or you don't have access",
            404
          );
        }

        whereClause.AND = [
          { property: { tenantId: userId } },
          { propertyId: propertyData.id },
        ];
      }
      console.log(
        "After property filter:",
        JSON.stringify(whereClause, null, 2)
      );
    }

    // Name filter
    if (name) {
      console.log("Applying name filter:", name);
      const cleanName = name.toString().trim();

      if (!whereClause.AND) {
        whereClause.AND = [];
      }

      whereClause.AND.push({
        name: {
          contains: cleanName,
          mode: "insensitive",
        },
      });
      console.log("After name filter:", JSON.stringify(whereClause, null, 2));
    }

    // Capacity filter
    if (capacity) {
      console.log("Applying capacity filter:", capacity);

      if (!whereClause.AND) {
        whereClause.AND = [];
      }

      whereClause.AND.push({
        capacity: {
          gte: Number(capacity),
        },
      });
      console.log(
        "After capacity filter:",
        JSON.stringify(whereClause, null, 2)
      );
    }

    // Availability filter
    if (checkInDate && checkOutDate) {
      console.log("Applying availability filter");
      const cleanCheckIn = checkInDate.toString().trim();
      const cleanCheckOut = checkOutDate.toString().trim();

      const checkIn = new Date(cleanCheckIn);
      const checkOut = new Date(cleanCheckOut);

      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
        throw new ApiError("Invalid check-in or check-out date", 400);
      }

      console.log("Filtering availability for dates:", { checkIn, checkOut });

      if (!whereClause.AND) {
        whereClause.AND = [];
      }

      // Room must have stock > 0
      whereClause.AND.push({
        stock: {
          gt: 0,
        },
      });

      // Room should NOT have non-availability records that overlap
      whereClause.AND.push({
        NOT: {
          roomNonAvailability: {
            some: {
              date: {
                gte: checkIn,
                lt: checkOut,
              },
            },
          },
        },
      });

      // Room should NOT have confirmed bookings that overlap
      whereClause.AND.push({
        NOT: {
          transactions: {
            some: {
              AND: [
                {
                  OR: [
                    {
                      AND: [
                        { startDate: { lt: checkOut } },
                        { endDate: { gt: checkIn } },
                      ],
                    },
                  ],
                },
                {
                  status: { in: ["PAID", "WAITING_FOR_CONFIRMATION"] },
                },
              ],
            },
          },
        },
      });

      console.log(
        "After availability filter:",
        JSON.stringify(whereClause, null, 2)
      );
    }

    console.log("=== FINAL TENANT ROOMS WHERE CLAUSE ===");
    console.log(JSON.stringify(whereClause, null, 2));

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
            city: true,
            category: true,
            createdAt: true,
            updatedAt: true,
            tenantId: true,
            tenant: true,
          },
        },
        images: true,
        facilities: {
          select: {
            id: true,
            title: true,
          },
        },
        roomNonAvailability: {
          select: {
            id: true,
            date: true,
            reason: true,
          },
        },
      },
    });

    console.log(`Query returned ${rooms.length} tenant rooms`);

    // Verify all rooms belong to the tenant (additional security check)
    const invalidRooms = rooms.filter(
      (room) => room.property.tenantId !== userId
    );
    if (invalidRooms.length > 0) {
      console.error("SECURITY VIOLATION: Found rooms not belonging to tenant", {
        userId,
        invalidRoomIds: invalidRooms.map((r) => r.id),
      });
      throw new ApiError("Security violation detected", 403);
    }

    const total = await this.prisma.room.count({ where: whereClause });
    console.log("Total tenant rooms with filter:", total);

    console.log("=== END TENANT ROOMS FETCH ===");

    return {
      data: rooms,
      meta: { page: Number(page), take: Number(take), total },
    };
  };

  createSeasonalRate = async (body: CreateSeasonalRateDTO, userId: number) => {
    const roomId = parseInt(body.roomId, 10);
    const adjustmentValue = parseFloat(body.adjustmentValue);

    // Verify room ownership
    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        property: { tenantId: userId },
      },
    });

    if (!room) {
      throw new ApiError("Room not found or you don't have access", 404);
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    if (startDate >= endDate) {
      throw new ApiError("End date must be after start date", 400);
    }

    // Check for overlapping seasonal rates
    const overlapping = await this.prisma.seasonalRate.findFirst({
      where: {
        roomId,
        isActive: true,
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gt: startDate } },
            ],
          },
          {
            AND: [
              { startDate: { lt: endDate } },
              { endDate: { gte: endDate } },
            ],
          },
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } },
            ],
          },
        ],
      },
    });

    if (overlapping) {
      throw new ApiError(
        "Seasonal rate already exists for overlapping dates",
        400
      );
    }

    const seasonalRate = await this.prisma.seasonalRate.create({
      data: {
        roomId,
        startDate,
        endDate,
        adjustmentValue,
        adjustmentType: body.adjustmentType,
        reason: body.reason,
      },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            property: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    return {
      message: "Seasonal rate created successfully",
      data: seasonalRate,
    };
  };

  getSeasonalRates = async (query: GetSeasonalRatesDTO, userId: number) => {
    const {
      take = "10",
      page = "1",
      sortBy = "startDate",
      sortOrder = "asc",
      roomId,
      startDate,
      endDate,
    } = query;

    const whereClause: any = {
      room: {
        property: { tenantId: userId },
      },
      isActive: true,
    };

    if (roomId) {
      whereClause.roomId = parseInt(roomId, 10);
    }

    if (startDate || endDate) {
      whereClause.AND = [];

      if (startDate) {
        whereClause.AND.push({
          endDate: { gte: new Date(startDate) },
        });
      }

      if (endDate) {
        whereClause.AND.push({
          startDate: { lte: new Date(endDate) },
        });
      }
    }

    const seasonalRates = await this.prisma.seasonalRate.findMany({
      where: whereClause,
      orderBy: { [sortBy]: sortOrder },
      skip: (Number(page) - 1) * Number(take),
      take: Number(take),
      include: {
        room: {
          select: {
            id: true,
            name: true,
            price: true,
            property: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    const total = await this.prisma.seasonalRate.count({ where: whereClause });

    return {
      data: seasonalRates,
      meta: { page: Number(page), take: Number(take), total },
    };
  };

  updateSeasonalRate = async (
    seasonalRateId: number,
    body: UpdateSeasonalRateDTO,
    userId: number
  ) => {
    const existingRate = await this.prisma.seasonalRate.findFirst({
      where: {
        id: seasonalRateId,
        room: {
          property: { tenantId: userId },
        },
      },
    });

    if (!existingRate) {
      throw new ApiError(
        "Seasonal rate not found or you don't have access",
        404
      );
    }

    const updateData: any = {};

    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.adjustmentValue)
      updateData.adjustmentValue = parseFloat(body.adjustmentValue);
    if (body.adjustmentType) updateData.adjustmentType = body.adjustmentType;
    if (body.reason !== undefined) updateData.reason = body.reason;

    const updatedRate = await this.prisma.seasonalRate.update({
      where: { id: seasonalRateId },
      data: updateData,
      include: {
        room: {
          select: {
            id: true,
            name: true,
            property: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    return {
      message: "Seasonal rate updated successfully",
      data: updatedRate,
    };
  };

  deleteSeasonalRate = async (seasonalRateId: number, userId: number) => {
    const seasonalRate = await this.prisma.seasonalRate.findFirst({
      where: {
        id: seasonalRateId,
        room: {
          property: { tenantId: userId },
        },
      },
    });

    if (!seasonalRate) {
      throw new ApiError(
        "Seasonal rate not found or you don't have access",
        404
      );
    }

    await this.prisma.seasonalRate.update({
      where: { id: seasonalRateId },
      data: { isActive: false },
    });

    return {
      message: "Seasonal rate deleted successfully",
    };
  };

  // Helper function untuk menghitung harga dengan seasonal rate
  calculatePriceWithSeasonalRate = async (
    roomId: number,
    checkInDate: Date,
    checkOutDate: Date
  ) => {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { price: true },
    });

    if (!room) {
      throw new ApiError("Room not found", 404);
    }

    const seasonalRates = await this.prisma.seasonalRate.findMany({
      where: {
        roomId,
        isActive: true,
        startDate: { lte: checkOutDate },
        endDate: { gte: checkInDate },
      },
      orderBy: { startDate: "asc" },
    });

    let totalPrice = 0;
    let currentDate = new Date(checkInDate);
    const basePrice = Number(room.price);

    while (currentDate < checkOutDate) {
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // Check if current date has seasonal rate
      const applicableRate = seasonalRates.find(
        (rate) => currentDate >= rate.startDate && currentDate < rate.endDate
      );

      let dailyPrice = basePrice;
      if (applicableRate) {
        if (applicableRate.adjustmentType === "PERCENTAGE") {
          dailyPrice =
            basePrice * (1 + Number(applicableRate.adjustmentValue) / 100);
        } else {
          dailyPrice = basePrice + Number(applicableRate.adjustmentValue);
        }
      }

      totalPrice += dailyPrice;
      currentDate = nextDay;
    }

    return totalPrice;
  };
}
