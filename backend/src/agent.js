import Anthropic from "@anthropic-ai/sdk";
import * as db from "./db.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = process.env.AGENT_EFFORT || "low";
// Server-side refusal fallbacks are not available on Haiku models.
const SUPPORTS_FALLBACK = !MODEL.startsWith("claude-haiku");
const MAX_TOOL_ROUNDS = 8;

const SYSTEM_PROMPT = `You are a helpful assistant for a customer management application.
Customer records have the fields id, name and email, and are stored in a PostgreSQL database.
Use the provided tools to read or change customer data; never invent customer records.
Before deleting a customer, make sure the request clearly identifies exactly one customer.
Keep answers concise. When listing several customers, use a short markdown table.`;

const systemPromptFor = (user) =>
  `${SYSTEM_PROMPT}\nYou are assisting the sales user ${user.name} (${user.email}). You can only see and change this user's customers.`;

const tools = [
  {
    name: "get_all_customers",
    description: "Return every customer in the database (id, name, email).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_customer_by_name",
    description: "Find customers whose name contains the given text (case-insensitive, partial match).",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Full or partial customer name" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_customer_by_id",
    description: "Return a single customer by numeric id.",
    input_schema: {
      type: "object",
      properties: { id: { type: "integer", description: "Customer id" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "add_customer",
    description: "Create a new customer with a name and email. Returns the created record.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Customer full name" },
        email: { type: "string", description: "Customer email address" },
      },
      required: ["name", "email"],
      additionalProperties: false,
    },
  },
  {
    name: "update_customer",
    description: "Update the name and/or email of an existing customer identified by id.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Customer id" },
        name: { type: "string", description: "New name (optional)" },
        email: { type: "string", description: "New email (optional)" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_customer",
    description: "Delete a customer by id. Returns the deleted record.",
    input_schema: {
      type: "object",
      properties: { id: { type: "integer", description: "Customer id" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

async function executeTool(name, input, userId) {
  switch (name) {
    case "get_all_customers":
      return db.getAllCustomers(userId);
    case "get_customer_by_name":
      return db.searchCustomersByName(userId, input.name);
    case "get_customer_by_id":
      return (await db.getCustomerById(userId, input.id)) ?? { error: `No customer with id ${input.id}` };
    case "add_customer":
      return db.createCustomer(userId, input);
    case "update_customer":
      return (await db.updateCustomer(userId, input.id, input)) ?? { error: `No customer with id ${input.id}` };
    case "delete_customer":
      return (await db.deleteCustomer(userId, input.id)) ?? { error: `No customer with id ${input.id}` };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

let client;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error("ANTHROPIC_API_KEY is not configured on the server");
    err.status = 503;
    throw err;
  }
  client ??= new Anthropic();
  return client;
}

/**
 * Run the agent over a conversation.
 * @param {{role: "user"|"assistant", content: string}[]} history plain-text chat turns, last one from the user
 * @param {{id: number, name: string, email: string}} user the logged-in sales user; every tool is scoped to them
 * @returns {Promise<{reply: string, toolCalls: {name: string, input: object}[]}>}
 */
export async function runAgent(history, user) {
  const anthropic = getClient();
  const messages = history.map(({ role, content }) => ({ role, content }));
  const toolCalls = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT },
      // Route refused requests to a fallback model automatically.
      ...(SUPPORTS_FALLBACK && { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
      system: systemPromptFor(user),
      tools,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { reply: "Sorry, I can't help with that request.", toolCalls };
    }

    if (response.stop_reason !== "tool_use") {
      const reply = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: reply || "(no response)", toolCalls };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const block of response.content.filter((b) => b.type === "tool_use")) {
      toolCalls.push({ name: block.name, input: block.input });
      try {
        const result = await executeTool(block.name, block.input, user.id);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      } catch (err) {
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: err.message, is_error: true });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { reply: "I couldn't finish that request within the allowed number of steps.", toolCalls };
}
