import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { IUser } from "../model/User.js";

interface JwtPayload {
    user: IUser;
}

export interface AuthenticatedRequest extends Request {
    user?: IUser | null;
}

export const isAuth = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({
                message: "Please Login",
            });
            return;
        }

        const token = authHeader.split(" ")[1] as string;
        const secret = String(process.env["JWT_SECRET"]);

        const decodedValue = jwt.verify(token, secret) as unknown as JwtPayload;

        if (!decodedValue || !decodedValue.user) {
            res.status(401).json({
                message: "Invalid token",
            });
            return;
        }

        req.user = decodedValue.user;
        next();
    } catch (error) {
        res.status(401).json({
            message: "Please Login - JWT error",
        });
    }
};
