import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: String(process.env["Cloud_Name"]),
  api_key: String(process.env["Api_Key"]),
  api_secret: String(process.env["Api_Secret"]),
});

export default cloudinary;
