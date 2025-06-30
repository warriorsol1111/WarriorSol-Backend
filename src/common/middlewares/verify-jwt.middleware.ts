import jwt from "jsonwebtoken";
import { failureResponse } from "../utils/responses.ts";
import { Request, Response } from "express";

interface DecodedToken {
  id: string;
  role: string;
  email: string;
  name: string;
}

const verifyToken = (req: Request, res: Response, next: () => void): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return failureResponse(res, 401, "Authorization header missing");
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return failureResponse(res, 401, "Token not provided");
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as DecodedToken;
    req.user = decoded;
    next();
  } catch (err) {
    return failureResponse(res, 401, "Invalid token");
  }
};

export default verifyToken;
