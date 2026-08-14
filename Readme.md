# Chat App — MERN Microservices Platform

A real-time chat application built with a **microservices architecture** (User, Chat, and Mail services)
communicating asynchronously via **RabbitMQ**, with **Socket.io** for live messaging, **Redis** for OTP/rate-limiting,
and **Cloudinary** for media uploads.

## Architecture
- **User Service** — Auth (OTP + JWT), profile management, MongoDB (Mongoose)
- **Chat Service** — Chat/message CRUD, Socket.io real-time layer, Cloudinary image uploads
- **Mail Service** — RabbitMQ consumer that sends OTP emails via Nodemailer (decoupled from the request/response cycle)

## Key Features
- OTP-based login (no passwords) with Redis-backed 5-min expiry + 1-min resend cooldown
- Non-blocking OTP delivery via RabbitMQ producer/consumer pattern
- JWT auth middleware shared across services
- Real-time messaging, typing indicators, online/offline presence, and read receipts via Socket.io
- Unread message counters and auto-sorted chat list (most recent conversation on top)
- Image messages via Multer + Cloudinary
- Dockerized RabbitMQ broker

## Tech Stack
Node.js, Express.js, TypeScript, MongoDB, Mongoose, Redis (Upstash), RabbitMQ (amqplib), Socket.io,
Next.js (frontend), Tailwind CSS, Cloudinary, JWT, Docker, PM2, AWS EC2

## Deployment
Deployed on a single AWS EC2 (Ubuntu) instance — RabbitMQ in Docker, three Node services managed by PM2,
and a statically built Next.js frontend served in production mode..

## Repository
https://github.com/siddeshrizwani/chat-app-microservices
