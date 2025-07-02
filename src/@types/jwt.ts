// types/express/index.d.ts
export interface JwtPayload {
  id: string;
  role: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}
