import { Router } from "express";
import * as db from "../db.js";
import { EMAIL_RE, hashPassword, verifyPassword, signToken, requireAuth } from "../auth.js";

const router = Router();
const publicUser = ({ id, name, email, role }) => ({ id, name, email, role });

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name is required" });
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: "email must be a valid email address" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  // Any role in the body is ignored: new users are always "sales" (the column default).
  const user = await db.createUser({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: await hashPassword(password),
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const user = await db.getUserByEmail(email.trim());
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await db.getUserById(req.user.id);
  if (!user) return res.status(401).json({ error: "User no longer exists" });
  res.json({ user: publicUser(user) });
});

export default router;
