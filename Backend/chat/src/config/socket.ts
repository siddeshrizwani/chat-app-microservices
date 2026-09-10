import { Server, Socket } from "socket.io";
import http from "http";
import express from "express";

// express app is created here (not in index.ts) because socket.io needs
// to attach itself to the same raw http server that express runs on
const app = express();

const server = http.createServer(app);

// socket.io server attached on top of the http server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// keeps track of which user is connected on which socket
// shape -> { userId: socketId }
const userSocketMap: Record<string, string> = {};

// helper used by controllers to send an event to one specific user
export const getRecieverSocketId = (recieverId: string): string | undefined => {
  return userSocketMap[recieverId];
};

io.on("connection", (socket: Socket) => {
  console.log("User Connected", socket.id);

  // frontend sends userId in the connection query -> io(chat_service, { query: { userId } })
  const userId = socket.handshake.query.userId as string | undefined;

  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
    console.log(`User ${userId} mapped to socket ${socket.id}`);
  }

  // broadcast the updated online users list to everyone
  io.emit("getOnlineUser", Object.keys(userSocketMap));

  // personal room for the user, useful for direct notifications
  if (userId) {
    socket.join(userId);
  }

  // typing indicator -> notify only the other people in that chat room
  socket.on("typing", (data) => {
    console.log(`User ${data.userId} is typing in chat ${data.chatId}`);
    socket.to(data.chatId).emit("userTyping", {
      chatId: data.chatId,
      userId: data.userId,
    });
  });

  socket.on("stopTyping", (data) => {
    console.log(`User ${data.userId} stopped typing in chat ${data.chatId}`);
    socket.to(data.chatId).emit("userStoppedTyping", {
      chatId: data.chatId,
      userId: data.userId,
    });
  });

  // when a user opens a chat, they join a room named after the chatId
  // this is how we know if the receiver is actually looking at the chat (for seen status)
  socket.on("joinChat", (chatId) => {
    socket.join(chatId);
    console.log(`User ${userId} joined chat room ${chatId}`);
  });

  socket.on("leaveChat", (chatId) => {
    socket.leave(chatId);
    console.log(`User ${userId} left chat room ${chatId}`);
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);

    // remove the user from online list and tell everyone
    if (userId) {
      delete userSocketMap[userId];
      console.log(`User ${userId} removed from online users`);
      io.emit("getOnlineUser", Object.keys(userSocketMap));
    }
  });

  socket.on("connect_error", (error) => {
    console.log("Socket connection Error", error);
  });
});

export { app, server, io };
