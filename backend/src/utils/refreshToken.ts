import crypto from "node:crypto";
import { env } from "@/config/env";

export function hashRefreshToken(token: string) {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(token).digest("hex");
}
