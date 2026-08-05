import mongoose from "mongoose";

const connectDb = async () => {
  const url = process.env.MONGO_URI;

  // Check if MongoDB URI exists
  if (!url) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }

  try {
    // Connect to MongoDB
    await mongoose.connect(url, {
      dbName: "Chatappmicroserviceapp",
    });

    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
};

export default connectDb;