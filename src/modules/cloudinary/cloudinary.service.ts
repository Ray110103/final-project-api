import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { Readable } from "stream";
import { ApiError } from "../../utils/api-error";

export class CloudinaryService {
  private isConfigured: boolean;
  constructor() {
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    this.isConfigured = Boolean(apiKey && apiSecret && cloudName);

    if (this.isConfigured) {
      cloudinary.config({
        api_key: apiKey,
        api_secret: apiSecret,
        cloud_name: cloudName,
      });
    } else {
      // Do not throw here to allow the app to boot; throw on usage instead
      console.warn(
        "Cloudinary credentials are not configured. Set CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME in your environment/.env."
      );
    }
  }

  private bufferToStream = (buffer: Buffer) => {
    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    return readable;
  };

  upload = (
    file: Express.Multer.File,
    folder?: string
  ): Promise<UploadApiResponse> => {
    if (!this.isConfigured) {
      throw new ApiError(
        "Cloudinary is not configured. Please set CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, and CLOUDINARY_CLOUD_NAME.",
        500
      );
    }
    return new Promise((resolve, reject) => {
      const readableStream = this.bufferToStream(file.buffer);

      const uploadStream = cloudinary.uploader.upload_stream(
        { folder },
        (err, result) => {
          if (err) return reject(err);

          if (!result)
            return reject(new Error("Upload failed: No result returned"));

          resolve(result);
        }
      );

      readableStream.pipe(uploadStream);
    });
  };

  private extractPublicIdFromUrl = (url: string) => {
    const urlParts = url.split("/");
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = publicIdWithExtension.split(".")[0];
    return publicId;
  };

  remove = async (secureUrl: string) => {
    if (!this.isConfigured) {
      throw new ApiError(
        "Cloudinary is not configured. Please set CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, and CLOUDINARY_CLOUD_NAME.",
        500
      );
    }
    const publicId = this.extractPublicIdFromUrl(secureUrl);
    return await cloudinary.uploader.destroy(publicId);
  };
}