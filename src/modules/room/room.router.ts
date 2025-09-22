import { Router } from "express";
import { RoomController } from "./room.controller";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import { CreateRoomsDTO } from "./dto/create-room.dto";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware";
import { UpdateRoomsDTO } from "./dto/update-room.dto";

const uploader = new UploaderMiddleware();

export class RoomRouter {
  private router: Router;
  private roomController: RoomController;
  private jwtMiddleware: JwtMiddleware;

  constructor() {
    this.router = Router();
    this.roomController = new RoomController();
    this.jwtMiddleware = new JwtMiddleware();
    this.initializeRoutes();
  }

  private initializeRoutes = () => {
    // ========================================
    // SPECIFIC ROUTES FIRST (before dynamic routes)
    // ========================================

    // Get tenant's rooms - MUST BE BEFORE /:id route
    this.router.get(
      "/tenant",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.roomController.getTenantRooms
    );

    // Mark room as unavailable
    this.router.post(
      "/non-availability",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.roomController.markRoomAsUnavailable
    );

    // Get rooms by property slug
    this.router.get(
      "/property/:slug/rooms",
      this.roomController.getRoomsByPropertySlug
    );

    // ========================================
    // GENERAL/PUBLIC ROUTES
    // ========================================

    // Get all rooms (with search/filter) - PUBLIC
    this.router.get("/", this.roomController.getRoom);

    // ========================================
    // PROTECTED ROUTES (TENANT only)
    // ========================================

    // CREATE ROOM
    this.router.post(
      "/",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      uploader.upload().fields([{ name: "images", maxCount: 10 }]),
      uploader.fileFilter(["image/jpeg", "image/png", "image/webp"]),
      validateBody(CreateRoomsDTO),
      this.roomController.createRoom
    );

    // UPDATE ROOM
    this.router.put(
      "/:id",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      uploader.upload().fields([{ name: "images", maxCount: 10 }]),
      uploader.fileFilter(["image/jpeg", "image/png", "image/webp"]),
      validateBody(UpdateRoomsDTO),
      this.roomController.updateRoom
    );

    // DELETE ROOM
    this.router.delete(
      "/:id",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.roomController.deleteRoom
    );

    // ========================================
    // DYNAMIC ROUTES LAST (after all specific routes)
    // ========================================

    // GET SINGLE ROOM BY ID - MUST BE LAST among GET routes
    this.router.get("/:id", this.roomController.getRoomById);

    this.router.post(
      "/seasonal-rates",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.roomController.createSeasonalRate
    );

    this.router.get(
      "/seasonal-rates",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.roomController.getSeasonalRates
    );

    this.router.put(
      "/seasonal-rates/:id",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.roomController.updateSeasonalRate
    );

    this.router.delete(
      "/seasonal-rates/:id",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      this.jwtMiddleware.verifyRole(["TENANT"]),
      this.roomController.deleteSeasonalRate
    );
  };

  getRouter = () => this.router;
}
