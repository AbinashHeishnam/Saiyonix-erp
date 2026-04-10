import crypto from "node:crypto";

const CSRF_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getCsrfSecret() {
  return process.env.JWT_SECRET ?? "";
}

function buildSignature(userId: string, issuedAt: number, secret: string) {
  return crypto.createHmac("sha256", secret).update(`${userId}:${issuedAt}`).digest("hex");
}

export function getOrCreateCsrfToken(userId: string, forceNew = false) {
  const secret = getCsrfSecret();
  if (!secret) return "";
  const issuedAt = forceNew ? Date.now() : Date.now();
  const signature = buildSignature(userId, issuedAt, secret);
  return `${issuedAt}.${signature}`;
}

export function validateCsrfToken(userId: string, token: string) {
  const secret = getCsrfSecret();
  if (!secret) return false;
  const [issuedAtRaw, signature] = token.split(".");
  const issuedAt = Number(issuedAtRaw);
  if (!issuedAt || !signature) return false;
  if (Date.now() - issuedAt > CSRF_TTL_MS) return false;
  const expected = buildSignature(userId, issuedAt, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
