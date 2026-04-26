import cors from "cors";
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://erp.kangleicareersolution.co.in",
];
const corsOptions = {
    origin: (origin, callback) => {
        // 1. Allow non-browser requests (mobile apps, curl, Postman)
        if (!origin) {
            return callback(null, true);
        }
        // 2. Allow your known frontend domains
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // 3. Allow Expo / React Native environments
        if (origin.startsWith("exp://") || // Expo dev / APK
            origin.startsWith("http://192.") || // Local network dev
            origin.startsWith("http://10.") || // Some LAN setups
            origin.startsWith("http://172.") // Docker / internal networks
        ) {
            return callback(null, true);
        }
        // 4. Block everything else
        console.error("❌ BLOCKED BY CORS:", origin);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "x-csrf-token",
    ],
};
export const corsMiddleware = cors(corsOptions);
