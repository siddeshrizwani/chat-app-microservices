import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
// Using createRequire because cloudinary's type exports conflict with strict tsconfig settings
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const cloudinary = require("../config/cloudinary.js").default;

// CloudinaryStorage streams the file directly to Cloudinary instead of saving to disk
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "chat-images",                               // Cloudinary folder name
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      { width: 800, height: 600, crop: "limit" },        // resize to max 800x600
      { quality: "auto" },                               // auto compress quality
    ],
  } as any,
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Only allow image files — reject PDFs, videos, etc.
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("only image allowed"));
    }
  },
});
