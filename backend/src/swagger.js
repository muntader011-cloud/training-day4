const customer = {
  type: "object",
  properties: {
    id: { type: "integer", example: 1 },
    name: { type: "string", example: "Ahmed Ali" },
    email: { type: "string", format: "email", example: "ahmed@example.com" },
  },
};

const customerInput = {
  type: "object",
  required: ["name", "email"],
  properties: {
    name: { type: "string", example: "Jane Doe" },
    email: { type: "string", format: "email", example: "jane@example.com" },
  },
};

const error = { type: "object", properties: { error: { type: "string" } } };
const idParam = { name: "id", in: "path", required: true, schema: { type: "integer" } };
const json = (schema) => ({ "application/json": { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const notFound = { description: "Customer not found", content: json(ref("Error")) };
const badRequest = { description: "Invalid input", content: json(ref("Error")) };

export function buildSwaggerSpec(port) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Customers API",
      version: "1.0.0",
      description:
        "CRUD operations on the `customers` table plus an AI agent endpoint that answers natural-language questions about customer data. No authentication required.",
    },
    servers: [{ url: `http://localhost:${port}` }],
    tags: [{ name: "Customers" }, { name: "Agent" }, { name: "Health" }],
    components: {
      schemas: {
        Customer: customer,
        CustomerInput: customerInput,
        CustomerUpdate: { ...customerInput, required: [] },
        Error: error,
      },
    },
    paths: {
      "/api/customers": {
        get: {
          tags: ["Customers"],
          summary: "List all customers, or search by name",
          parameters: [
            { name: "name", in: "query", required: false, description: "Partial, case-insensitive name filter", schema: { type: "string" } },
          ],
          responses: { 200: { description: "Customers", content: json({ type: "array", items: ref("Customer") }) } },
        },
        post: {
          tags: ["Customers"],
          summary: "Create a customer",
          requestBody: { required: true, content: json(ref("CustomerInput")) },
          responses: { 201: { description: "Created", content: json(ref("Customer")) }, 400: badRequest },
        },
      },
      "/api/customers/{id}": {
        parameters: [idParam],
        get: {
          tags: ["Customers"],
          summary: "Get a customer by id",
          responses: { 200: { description: "Customer", content: json(ref("Customer")) }, 404: notFound },
        },
        put: {
          tags: ["Customers"],
          summary: "Update a customer (name and/or email)",
          requestBody: { required: true, content: json(ref("CustomerUpdate")) },
          responses: { 200: { description: "Updated", content: json(ref("Customer")) }, 400: badRequest, 404: notFound },
        },
        delete: {
          tags: ["Customers"],
          summary: "Delete a customer",
          responses: {
            200: {
              description: "Deleted",
              content: json({ type: "object", properties: { message: { type: "string" }, customer: ref("Customer") } }),
            },
            404: notFound,
          },
        },
      },
      "/api/agent": {
        post: {
          tags: ["Agent"],
          summary: "Ask a natural-language question about customers",
          description:
            "Claude answers using tools that list, search, add, update and delete customers. Pass previous turns in `history` for a multi-turn conversation.",
          requestBody: {
            required: true,
            content: json({
              type: "object",
              required: ["message"],
              properties: {
                message: { type: "string", example: "Get all customers" },
                history: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { role: { type: "string", enum: ["user", "assistant"] }, content: { type: "string" } },
                  },
                },
              },
            }),
          },
          responses: {
            200: {
              description: "Agent reply",
              content: json({
                type: "object",
                properties: {
                  reply: { type: "string" },
                  toolCalls: {
                    type: "array",
                    items: { type: "object", properties: { name: { type: "string" }, input: { type: "object" } } },
                  },
                },
              }),
            },
            400: badRequest,
            503: { description: "ANTHROPIC_API_KEY not configured", content: json(ref("Error")) },
          },
        },
      },
      "/api/health": {
        get: { tags: ["Health"], summary: "Health check (includes database connectivity)", responses: { 200: { description: "OK" } } },
      },
    },
  };
}
