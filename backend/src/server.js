// Local entry point. On Vercel, api/index.js exports the same app as a serverless function.
import app from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Swagger UI:   http://localhost:${PORT}/swagger`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("ANTHROPIC_API_KEY is not set - /api/agent will return 503");
});
