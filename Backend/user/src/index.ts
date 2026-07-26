import express from "express";
import dotenv from "dotenv";
import connectDb from "./config/db.js";
import {createClient} from "redis";
import userRoutes from "./routes/user.js";

dotenv.config();

connectDb();

if (!process.env.REDIS_URL) throw new Error("REDIS_URL is not defined");

export const redisClient = createClient({
    url: process.env.REDIS_URL,
});
redisClient
.connect()
.then(()=>console.log("connected to redis"))
.catch(console.error);


const app=express();

app.use("/api/v1",userRoutes);

const port=process.env.PORT

app.listen(port , ()=>{
    console.log(`Server is running on port ${port}`);
})