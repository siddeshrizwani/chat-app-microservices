import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { publishToQueue } from "../config/rabbitmq.js";
import User from "../model/User.js";

export const loginUser = TryCatch(async (req, res) => {
    const { email } = req.body;

    const rateLimitKey = `rate_limit:${email}`;

    // Check rate limit — max 3 OTP requests per 5 minutes
    const requests = await redisClient.get(rateLimitKey);

    if (requests && Number(requests) >= 3) {
        res.status(429).json({
            message: "Too many requests. Please try again after 5 minutes.",
        });
        return;
    }

    // Increment request count, set expiry of 5 min on first request
    const multi = redisClient.multi();
    multi.incr(rateLimitKey);
    multi.expire(rateLimitKey, 300, 'NX'); // NX = only set expiry if it doesn't already exist
    await multi.exec();

    // Find or create user
    let user = await User.findOne({ email });

    if (!user) {
        user = await User.create({ email, name: email.split("@")[0] });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with 5 min expiry
    await redisClient.set(`otp:${email}`, otp, { EX: 300 });

    // Publish OTP email to RabbitMQ
    await publishToQueue("send_otp", {
        to: email,
        subject: "Your OTP Code",
        body: `Your OTP is: ${otp}. It expires in 5 minutes.`,
    });

    res.status(200).json({
        message: "OTP sent to your email.",
    });
});
