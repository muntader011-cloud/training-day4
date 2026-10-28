import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { pool } from "./db.js";
import customersRouter from "./routes/customers.js";
import agentRouter from "./routes/agent.js";
import { buildSwaggerSpec } from "./swagger.js";

const PORT = Number(process.env.PORT) || 3000;
const app = express();

// Allow cross-origin requests from the frontend (comma-separated list, or "*" for any origin).
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((o) => o.trim());
app.use(cors({ origin: origins.includes("*") ? "*" : origins }));
app.use(express.json());

app.use("/swagger", swaggerUi.serve, swaggerUi.setup(buildSwaggerSpec(PORT)));
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

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Swagger UI:   http://localhost:${PORT}/swagger`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("ANTHROPIC_API_KEY is not set - /api/agent will return 503");
});
