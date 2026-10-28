import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import customersRouter from "./routes/customers.js";
import agentRouter from "./routes/agent.js";
import { swaggerSpec, swaggerHtml } from "./swagger.js";

const app = express();

// Allow cross-origin requests from the frontend (comma-separated list, or "*" for any origin).
// Frontends deployed on Vercel (https://*.vercel.app) are always allowed.
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((o) => o.trim().replace(/\/$/, ""));
app.use(cors({ origin: origins.includes("*") ? "*" : [...origins, /^https:\/\/[a-z0-9-]+\.vercel\.app$/] }));
app.use(express.json());

// Swagger UI assets load from a CDN, so nothing from node_modules has to be bundled into the Vercel function.
app.get("/swagger.json", (req, res) => res.json(swaggerSpec));
app.get("/swagger", (req, res) => res.type("html").send(swaggerHtml));
app.get("/", (req, res) => res.redirect("/swagger"));

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected", agent: Boolean(process.env.ANTHROPIC_API_KEY) });
  } catch (err) {
    res.status(503).json({ status: "error", database: err.message });
  }
});

app.use("/api/customers", customersRouter);
app.use("/api/agent", agentRouter);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Express 5 forwards rejected promises from async handlers here.
app.use((err, req, res, next) => {
  if (err.code === "23505") return res.status(409).json({ error: "A customer with that value already exists" });
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

export default app;
