import passport from "passport";
import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptions,
} from "passport-jwt";
import { usersTable } from "../database/schema";
import db from "../database/index";
import { eq } from "drizzle-orm";

// Verify JWT_SECRET exists
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

const opts: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET as string,
};

passport.use(
  new JwtStrategy(
    opts,
    async (
      jwt_payload: { id: number },
      done: (error: any, user?: any) => void
    ) => {
      try {
        const [user] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, jwt_payload.id.toString()))
          .limit(1);
        if (user) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

export default passport;
