import jwt from "jsonwebtoken";
function getJwtSecret() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return jwtSecret;
}
export function signToken(payload) {
    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: "7d",
    });
}
export function verifyToken(token) {
    return jwt.verify(token, getJwtSecret());
}
