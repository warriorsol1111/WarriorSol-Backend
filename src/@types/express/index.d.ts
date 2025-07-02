// @types/express.d.ts

import { JwtPayload } from "../jwt.ts";

declare global {
  namespace Express {
    interface User extends JwtPayload {}
    interface Request {
      user?: User;
    }
  }
}
