import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

// Configure cloudinary
cloudinary.config({
  cloud_name: "dr5yanrd3",
  api_key: "519132624567416",
  api_secret: "TD6xU0uGkCahyu0Gv763GfEMdww",
});

interface UploadResponse {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format: string;
  duration?: number;
}

export async function uploadFile(
  file: Express.Multer.File,
  options: {
    folder?: string;
    transformation?: any[];
  } = {}
): Promise<UploadResponse> {
  try {
    const b64 = Buffer.from(file.buffer).toString("base64");
    const dataURI = `data:${file.mimetype};base64,${b64}`;

    const uploadOptions: any = {
      resource_type: "auto", // Let Cloudinary detect type
      folder: options.folder || "uploads",
    };

    if (options.transformation) {
      uploadOptions.transformation = options.transformation;
    }

    const folderPath = options.folder ? `${options.folder}/` : "";
    const uniqueFilename = `${new Date().getTime()}___${file.originalname}`;

    uploadOptions.public_id = `${folderPath}${uniqueFilename}`;

    const result = await cloudinary.uploader.upload(dataURI, uploadOptions);

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format,
      duration: result.duration,
    };
  } catch (error) {
    console.error("File upload failed:", error);
    throw new Error(`File upload failed: ${error}`);
  }
}
