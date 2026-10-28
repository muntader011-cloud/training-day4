import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { runAgent } from "../agent.js";

const router = Router();

router.post("/", async (req, res) => {
  const { message, history = [] } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  const validHistory = Array.isArray(history)
    ? history.filter(
        (m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim()
      )
    : [];

  try {
    const result = await runAgent([...validHistory, { role: "user", content: message.trim() }]);
    res.json(result);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "The AI service is rate limited, please retry shortly." });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(502).json({ error: "Invalid Anthropic API key configured on the server." });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", err.status, err.message);
      return res.status(502).json({ error: `AI service error: ${err.message}` });
    }
    throw err;
  }
});

export default router;
