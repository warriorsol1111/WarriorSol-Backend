import { NextFunction, Request, Response } from "express";
import passport from "passport";

const authenticateJwt = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("jwt", { session: false }, (err: any, user: any) => {
    if (err) {
      console.error("JWT Authentication Error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  })(req, res, next);
};

export default authenticateJwt;
