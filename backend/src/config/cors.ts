import cors from "cors";

const allowedOrigins = [
  "http://localhost:5173",   // frontend dev
  "http://localhost:3000",   // local dev
  "https://school.saiyonix.com", // production frontend
];

export const corsMiddleware = cors({
  origin: function (origin, callback) {

    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,
});
