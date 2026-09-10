import TryCatch from "../config/TryCatch.js";
import { AuthenticatedRequest } from "../middlewares/isAuth.js";
import { Chat } from "../models/Chat.js";
import { Messages } from "../models/Messages.js";
import axios from "axios";
import { getRecieverSocketId, io } from "../config/socket.js";

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


// Send a text or image message in a chat
export const sendMessage = TryCatch(async (req: AuthenticatedRequest, res) => {
  const senderId = req.user?._id;
  const { chatId, text } = req.body;
  // req.file added by multer — holds uploaded image info from Cloudinary
  const imageFile = (req as any).file;

  if (!senderId) {
    res.status(401).json({ message: "unauthorized" });
    return;
  }

  if (!chatId) {
    res.status(400).json({ message: "ChatId Required" });
    return;
  }

  // must send either text or image
  if (!text && !imageFile) {
    res.status(400).json({ message: "Either text or image is required" });
    return;
  }

  const chat = await Chat.findById(chatId);

  if (!chat) {
    res.status(404).json({ message: "Chat not found" });
    return;
  }

  // security — only participants can send messages
  const isUserInChat = chat.users.some(
    (userId) => userId.toString() === senderId.toString()
  );

  if (!isUserInChat) {
    res.status(403).json({ message: "You are not a participant of this chat" });
    return;
  }

  // needed for socket notification later
  const otherUserId = chat.users.find(
    (userId) => userId.toString() !== senderId.toString()
  );

  if (!otherUserId) {
    res.status(401).json({ message: "No other user" });
    return;
  }

  //socket setup
  // find the receiver's live socket, if they are online at all
  const receiverSocketId = getRecieverSocketId(otherUserId.toString());
  let isReceiverInChatRoom = false;

  // being online is not enough — check if they have this chat actually open
  // (they joined the room named after chatId via the "joinChat" event)
  // if yes, the message is marked seen straight away
  if (receiverSocketId) {
    const receiverSocket = io.sockets.sockets.get(receiverSocketId);
    if (receiverSocket && receiverSocket.rooms.has(chatId)) {
      isReceiverInChatRoom = true;
    }
  }

  // base message data — seen is true only if receiver is currently in the chat room
  let messageData: any = {
    chatId,
    sender: senderId,
    seen: isReceiverInChatRoom,
    seenAt: isReceiverInChatRoom ? new Date() : undefined,
  };

  // fill image or text fields based on what was sent
  if (imageFile) {
    messageData.image = { url: (imageFile as any).path, publicId: (imageFile as any).filename };
    messageData.messageType = "image";
    messageData.text = text || "";
  } else {
    messageData.text = text;
    messageData.messageType = "text";
  }

  // save message to DB
  const message = new Messages(messageData);
  const savedMessage = await message.save();

  // update chat's latest message — shown as preview in chat list
  const latestMessageText = imageFile ? "Image" : text;
  await Chat.findByIdAndUpdate(
    chatId,
    { latestMessage: { text: latestMessageText, sender: senderId }, updatedAt: new Date() },
    { new: true }
  );

  //emit to sockets
  // everyone currently inside this chat room gets the message instantly
  io.to(chatId).emit("newMessage", savedMessage);

  // also send directly to the receiver even if the chat is not open,
  // so their chat list preview and unseen count update live
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("newMessage", savedMessage);
  }

  // send to the sender's own socket too, keeps other tabs/devices in sync
  const senderSocketId = getRecieverSocketId(senderId.toString());
  if (senderSocketId) {
    io.to(senderSocketId).emit("newMessage", savedMessage);
  }

  // receiver already had the chat open, so tell the sender it was seen right away (blue tick)
  if (isReceiverInChatRoom && senderSocketId) {
    io.to(senderSocketId).emit("messagesSeen", {
      chatId,
      seenBy: otherUserId,
      messageIds: [savedMessage._id],
    });
  }

  res.status(201).json({ message: savedMessage, sender: senderId });
});

// Opens a chat — fetches all messages and marks unread ones as seen
export const getMessagesByChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { chatId } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!chatId) {
      res.status(400).json({ message: "ChatId Required" });
      return;
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }

    // security — only participants can read messages
    const isUserInChat = chat.users.some(
      (userId) => userId.toString() === userId.toString()
    );

    if (!isUserInChat) {
      res.status(403).json({ message: "You are not a participant of this chat" });
      return;
    }

    // find unread messages from the other person before marking them seen
    // stored separately so we can notify sender via socket later (double tick → blue tick)
    const messagesToMarkSeen = await Messages.find({
      chatId,
      sender: { $ne: userId },
      seen: false,
    });

    // mark all unread messages from the other person as seen
    await Messages.updateMany(
      { chatId, sender: { $ne: userId }, seen: false },
      { seen: true, seenAt: new Date() }
    );

    // fetch all messages oldest first — renders top to bottom on frontend
    const messages = await Messages.find({ chatId }).sort({ createdAt: 1 });

    // find the other person's id to fetch their profile
    const otherUserId = chat.users.find((id) => id !== userId);

    try {
      // inter-service call — get other user's profile from user service for chat header
      const { data } = await axios.get(
        `${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`
      );

      if (!otherUserId) {
        res.status(400).json({ message: "No other user" });
        return;
      }

      //socket — notify the sender that their messages were just seen (blue tick)
      if (messagesToMarkSeen.length > 0) {
        const otherUserSocketId = getRecieverSocketId(otherUserId.toString());
        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit("messagesSeen", {
            chatId,
            seenBy: userId,
            messageIds: messagesToMarkSeen.map((msg) => msg._id),
          });
        }
      }

      // return all messages + other user's profile for the chat screen
      res.json({ messages, user: data });
    } catch (error) {
      // user service down — return fallback user
      console.log(error);
      res.json({ messages, user: { _id: otherUserId, name: "Unknown User" } });
    }
  }
);
