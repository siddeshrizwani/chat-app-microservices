import amqp from "amqplib";
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

export const startSendOtpConsumer = async () => {
    try {
        const connection = await amqp.connect({
            protocol: "amqp",
            hostname: process.env.Rabbitmq_Host!,
            port: 5672,
            username: process.env.Rabbitmq_Username!,
            password: process.env.Rabbitmq_Password!,
        });

        const channel = await connection.createChannel();
        const queueName = "send_otp";

        await channel.assertQueue(queueName, { durable: true });
        console.log(`Listening for messages on queue: ${queueName}`);

        channel.consume(queueName, async (msg) => {
            if (!msg) return;

            const { to, subject, body } = JSON.parse(msg.content.toString());

            try {
                const transporter = nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: 465,
                    secure: true,
                    auth: {
                        user: process.env.MAIL_USER,
                        pass: process.env.MAIL_PASS,
                    },
                });

                await transporter.sendMail({
                    from: "Chat app",
                    to,
                    subject,
                    text: body,
                });

                console.log(`OTP mail sent to ${to}`);
                channel.ack(msg);
            } catch (error) {
                console.log("Failed to send email:", error);
                channel.nack(msg, false, false); // discard the message so it doesn't block the queue
            }
        });

    } catch (error) {
        console.log("Failed to send =", error);
    }
};
