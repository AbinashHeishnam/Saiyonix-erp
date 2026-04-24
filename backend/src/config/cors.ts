import cors from "cors";
import { CorsOptions } from "cors";

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://erp.kangleicareersolution.co.in",
];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // mobile / server

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error("❌ BLOCKED BY CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

export const corsMiddleware = cors(corsOptions);