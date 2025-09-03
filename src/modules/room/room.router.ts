import { Router } from "express";
import { RoomController } from "./room.controller";
import { JwtMiddleware } from "../../middlewares/jwt.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import { CreateRoomsDTO } from "./dto/create-room.dto";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware";

const uploader = new UploaderMiddleware

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
    this.router.get("/", this.roomController.getRoom);
    this.router.post(
      "/",
      this.jwtMiddleware.verifyToken(process.env.JWT_SECRET!),
      uploader.upload().none(),
      validateBody(CreateRoomsDTO),
      this.roomController.createRoom
    );
  };

  getRouter = () => this.router;
}
