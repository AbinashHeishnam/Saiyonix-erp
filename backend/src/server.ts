import "dotenv/config";
import { env } from "./config/env";
import app from "./app";

const PORT = env.PORT;

console.log("Environment loaded successfully");
console.log("ENV OK:", {
  database: !!process.env.DATABASE_URL,
  jwt: !!process.env.JWT_SECRET,
});

app.listen(PORT, () => {
  console.log(`SaiyoniX ERP API running on port ${PORT}`);
});
