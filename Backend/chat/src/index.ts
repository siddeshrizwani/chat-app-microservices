import express from "express";
import dotenv from "dotenv";
import connectDb from "./config/db.js";
import chatRoutes from "./routes/chat.js";
import cors from "cors";
// app and server now come from socket.ts so that express and socket.io
// share the same http server
import { app, server } from "./config/socket.js";

dotenv.config();

connectDb();

app.use(express.json());

app.use(cors());

app.use("/api/v1", chatRoutes);

const port = process.env.PORT;

// listen on the http server (not app.listen) otherwise socket.io won't work
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
