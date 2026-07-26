import mongoose, { Document, Schema } from "mongoose";

// TypeScript Interface
export interface IUser extends Document {
  name: string;
  email: string;
}

// Mongoose Schema
const userSchema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Mongoose Model
const User = mongoose.model<IUser>("User", userSchema);

export default User;