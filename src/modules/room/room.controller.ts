import { CreateRoomsDTO } from "./dto/create-room.dto";
import { GetRoomsDTO } from "./dto/get-room.dto";
import { RoomService } from "./room.service";
import { Request, Response } from "express";

export class RoomController {
  private roomService: RoomService;

  constructor() {
    this.roomService = new RoomService();
  }

  // ✅ GET ROOM
  getRoom = async (req: Request, res: Response) => {
    const query = req.query as unknown as GetRoomsDTO;
    const result = await this.roomService.getRooms(query);
    res.status(200).send(result);
  };

  // ✅ CREATE ROOM with images upload
  createRoom = async (req: Request, res: Response) => {
    const authUserId = res.locals.user.id;
    const body = req.body as CreateRoomsDTO;

    // Ambil files dari multer (images[])
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const images = files?.images || [];

    const result = await this.roomService.createRoom(body, authUserId, images);

    res.status(201).send(result);
  };
}
