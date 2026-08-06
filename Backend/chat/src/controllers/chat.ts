import TryCatch from "../config/TryCatch.js";
import { AuthenticatedRequest } from "../middlewares/isAuth.js";
import { Chat } from "../models/Chat.js";
import { Messages } from "../models/Messages.js";
import axios from "axios";

// Creates a new 1-on-1 chat between the logged-in user and another user
export const createNewChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { otherUserId } = req.body;

    if (!otherUserId) {
      res.status(400).json({ message: "Other userid is required" });
      return;
    }

    // Check if a chat between these two users already exists
    const existingChat = await Chat.findOne({
      users: { $all: [userId, otherUserId], $size: 2 },
    });

    if (existingChat) {
      res.json({ message: "Chat already exitst", chatId: existingChat._id });
      return;
    }

    // No existing chat — create a new one
    const newChat = await Chat.create({
      users: [userId, otherUserId],
    });

    res.status(201).json({ message: "New Chat created", chatId: newChat._id });
  }
);

// Returns all chats for the logged-in user (like WhatsApp home screen)
export const getAllChats = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;

  if (!userId) {
    res.status(400).json({ message: "UserId missing" });
    return;
  }

  // Get all chats where this user is a participant, newest first
  const chats = await Chat.find({ users: userId }).sort({ updatedAt: -1 });

  // For each chat, enrich with other user's profile + unseen message count
  const chatWithUserData = await Promise.all(
    chats.map(async (chat) => {
      // Find the other person in the chat (not the logged-in user)
      const otherUserId = chat.users.find((id) => id !== userId);

      // Count messages sent by the other person that haven't been seen yet (unread badge)
      const unseenCount = await Messages.countDocuments({
        chatId: chat._id,
        sender: { $ne: userId },
        seen: false,
      });

      try {
        // Fetch the other user's profile from the User microservice via HTTP
        // This is inter-service communication — chat service doesn't have user data directly
        const { data } = await axios.get(
          `${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`
        );

        return {
          user: data,
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || null,
            unseenCount,
          },
        };
      } catch (error) {
        // If user service is down or user not found, return fallback instead of crashing
        return {
          user: { _id: otherUserId, name: "Unknown User" },
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || null,
            unseenCount,
          },
        };
      }
    })
  );

  res.json({ chats: chatWithUserData });
});
