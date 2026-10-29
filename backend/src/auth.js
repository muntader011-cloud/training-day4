import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSecret() {
  if (!process.env.JWT_SECRET) {
    const err = new Error("JWT_SECRET is not configured on the server");
    err.status = 503;
    throw err;
  }
  return process.env.JWT_SECRET;
}

export const hashPassword = (password) => bcrypt.hash(password, 10);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export function signToken(user) {
  return jwt.sign({ role: user.role, name: user.name, email: user.email }, getSecret(), {
    subject: String(user.id),
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

// Requires "Authorization: Bearer <token>" and sets req.user = { id, role, name, email }.
export function requireAuth(req, res, next) {
  const secret = getSecret();
  const [scheme, token] = (req.get("authorization") || "").split(" ");
  if (scheme !== "Bearer" || !token) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    req.user = { id: Number(payload.sub), role: payload.role, name: payload.name, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
