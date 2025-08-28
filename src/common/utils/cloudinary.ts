import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

// Configure cloudinary
cloudinary.config({
  cloud_name: "dr5yanrd3",
  api_key: "519132624567416",
  api_secret: "TD6xU0uGkCahyu0Gv763GfEMdww",
});

export async function uploadFile(
  file: Express.Multer.File,
  options: {
    folder?: string;
    transformation?: any[];
  } = {}
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    try {
      const folderPath = options.folder ? `${options.folder}/` : "";
      const uniqueFilename = `${Date.now()}___${file.originalname}`;

      const uploadOptions: any = {
        resource_type: "auto", // auto-detect (image, video, etc.)
        folder: options.folder || "uploads",
        public_id: `${folderPath}${uniqueFilename}`,
      };

      if (options.transformation) {
        uploadOptions.transformation = options.transformation;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload failed:", error);
            return reject(error);
          }

          if (!result) {
            return reject(new Error("Cloudinary returned no result"));
          }

          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        }
      );

      uploadStream.end(file.buffer);
    } catch (err) {
      console.error("Upload error:", err);
      reject(err);
    }
  });
}
