import { ApiError } from "../../utils/api-error";
import { CreateRoomsDTO } from "./dto/create-room.dto";
import { GetRoomsDTO } from "./dto/get-room.dto";
import { RoomService } from "./room.service";
import { Request, Response } from "express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateRoomsDTO } from "./dto/update-room.dto";
import { CreateSeasonalRateDTO } from "./dto/create-seasonal-rate.dto";
import { GetSeasonalRatesDTO } from "./dto/get-seasonal-rates.dto";
import { UpdateSeasonalRateDTO } from "./dto/update-seasonal-rate.dto";

export class RoomController {
  private roomService: RoomService;

  constructor() {
    this.roomService = new RoomService();
  }

  // GET ALL ROOMS (with search/filter)
  getRoom = async (req: Request, res: Response) => {
    try {
      const query = req.query as unknown as GetRoomsDTO;
      const result = await this.roomService.getRooms(query);
      res.status(200).send(result);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  };

  // GET ROOMS BY PROPERTY SLUG - Fixed method
  getRoomsByPropertySlug = async (req: Request, res: Response) => {
    const { slug } = req.params;
    console.log("Received request for property slug:", slug);

    try {
      const rooms = await this.roomService.getRoomsByPropertySlug(slug);

      // Always return 200 with rooms array (empty or with data)
      return res.status(200).json(rooms);
    } catch (error) {
      console.error("Error fetching rooms by property slug:", error);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          message: error.message,
          error: error.statusCode === 404 ? "PROPERTY_NOT_FOUND" : "API_ERROR",
        });
      }

      return res.status(500).json({
        message: "Internal server error",
        error: "SERVER_ERROR",
      });
    }
  };

  // GET SINGLE ROOM BY ID
  getRoomById = async (req: Request, res: Response) => {
    try {
      const roomId = Number(req.params.id);
      const userId = res.locals.user?.id; // Optional for ownership check

      if (!roomId || isNaN(roomId)) {
        throw new ApiError("Invalid room ID", 400);
      }

      const room = await this.roomService.getRoomById(roomId, userId);
      res.status(200).json(room);
    } catch (error) {
      console.error("Error fetching room by ID:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  };

  // Add this new method to RoomController
  getTenantRooms = async (req: Request, res: Response) => {
    try {
      const authUserId = res.locals.user.id; // Get tenant ID from JWT
      const query = req.query as unknown as GetRoomsDTO;

      console.log("Fetching rooms for tenant:", authUserId);

      const result = await this.roomService.getTenantRooms(query, authUserId);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching tenant rooms:", error);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      res.status(500).json({ message: "Internal server error" });
    }
  };

  // MARK ROOM AS UNAVAILABLE
  markRoomAsUnavailable = async (req: Request, res: Response) => {
    try {
      const { roomId, date, reason } = req.body;
      const authUserId = res.locals.user.id; // Ambil user ID dari JWT

      if (!roomId || isNaN(Number(roomId))) {
        return res.status(400).json({ message: "Invalid or missing roomId" });
      }
      const numericRoomId = Number(roomId);

      const nonAvailabilityDate = new Date(date);
      if (isNaN(nonAvailabilityDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      if (!reason || typeof reason !== "string" || reason.trim() === "") {
        return res.status(400).json({ message: "Reason is required" });
      }

      // Pass authUserId ke service untuk validasi ownership
      const result = await this.roomService.markRoomAsUnavailable(
        numericRoomId,
        nonAvailabilityDate,
        reason.trim(),
        authUserId
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error marking room unavailable:", error);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  };

  // CREATE ROOM
  createRoom = async (req: Request, res: Response) => {
    try {
      const authUserId = res.locals.user.id;

      // Validate DTO
      const bodyDto = plainToInstance(CreateRoomsDTO, req.body);
      const errors = await validate(bodyDto);

      if (errors.length > 0) {
        const errorMessages = errors
          .map((error) => Object.values(error.constraints || {}).join(", "))
          .join("; ");
        throw new ApiError(`Validation failed: ${errorMessages}`, 400);
      }

      // Get files from multer
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const images = files?.images || [];

      const result = await this.roomService.createRoom(
        bodyDto,
        authUserId,
        images
      );
      res.status(201).send(result);
    } catch (error) {
      console.error("Error creating room:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  };

  // UPDATE ROOM
  updateRoom = async (req: Request, res: Response) => {
    try {
      const roomId = Number(req.params.id);
      const authUserId = res.locals.user.id;

      if (!roomId || isNaN(roomId)) {
        throw new ApiError("Invalid room ID", 400);
      }

      // Validate UPDATE DTO
      const bodyDto = plainToInstance(UpdateRoomsDTO, req.body);
      const errors = await validate(bodyDto);

      if (errors.length > 0) {
        const errorMessages = errors
          .map((error) => Object.values(error.constraints || {}).join(", "))
          .join("; ");
        throw new ApiError(`Validation failed: ${errorMessages}`, 400);
      }

      // Get files from multer
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const images = files?.images || [];

      const result = await this.roomService.updateRoom(
        roomId,
        bodyDto,
        authUserId,
        images.length > 0 ? images : undefined
      );

      res.status(200).json(result);
    } catch (error) {
      console.error("Error updating room:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  };

  // DELETE ROOM
  deleteRoom = async (req: Request, res: Response) => {
    try {
      const roomId = Number(req.params.id);
      const authUserId = res.locals.user.id;

      if (!roomId || isNaN(roomId)) {
        throw new ApiError("Invalid room ID", 400);
      }

      const result = await this.roomService.deleteRoom(roomId, authUserId);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error deleting room:", error);

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  };

  createSeasonalRate = async (req: Request, res: Response) => {
    try {
      const authUserId = res.locals.user.id;
      const bodyDto = plainToInstance(CreateSeasonalRateDTO, req.body);
      const errors = await validate(bodyDto);

      if (errors.length > 0) {
        const errorMessages = errors
          .map((error) => Object.values(error.constraints || {}).join(", "))
          .join("; ");
        throw new ApiError(`Validation failed: ${errorMessages}`, 400);
      }

      const result = await this.roomService.createSeasonalRate(
        bodyDto,
        authUserId
      );
      res.status(201).json(result);
    } catch (error) {
      // Error handling logic
    }
  };

  getSeasonalRates = async (req: Request, res: Response) => {
    try {
      const authUserId = res.locals.user.id;
      const query = req.query as unknown as GetSeasonalRatesDTO;

      const result = await this.roomService.getSeasonalRates(query, authUserId);
      res.status(200).json(result);
    } catch (error) {
      // Error handling logic
    }
  };

  updateSeasonalRate = async (req: Request, res: Response) => {
    try {
      const seasonalRateId = Number(req.params.id);
      const authUserId = res.locals.user.id;

      const bodyDto = plainToInstance(UpdateSeasonalRateDTO, req.body);
      const errors = await validate(bodyDto);

      if (errors.length > 0) {
        const errorMessages = errors
          .map((error) => Object.values(error.constraints || {}).join(", "))
          .join("; ");
        throw new ApiError(`Validation failed: ${errorMessages}`, 400);
      }

      const result = await this.roomService.updateSeasonalRate(
        seasonalRateId,
        bodyDto,
        authUserId
      );
      res.status(200).json(result);
    } catch (error) {
      // Error handling logic
    }
  };

  deleteSeasonalRate = async (req: Request, res: Response) => {
    try {
      const seasonalRateId = Number(req.params.id);
      const authUserId = res.locals.user.id;

      const result = await this.roomService.deleteSeasonalRate(
        seasonalRateId,
        authUserId
      );
      res.status(200).json(result);
    } catch (error) {
      // Error handling logic
    }
  };
}
