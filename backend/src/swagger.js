const customer = {
  type: "object",
  properties: {
    id: { type: "integer", example: 1 },
    name: { type: "string", example: "Ahmed Ali" },
    email: { type: "string", format: "email", example: "ahmed@example.com" },
    sales_user_id: { type: "integer", readOnly: true, example: 1, description: "Id of the sales user who owns this customer" },
  },
};

const user = {
  type: "object",
  properties: {
    id: { type: "integer", example: 1 },
    name: { type: "string", example: "Sara Sales" },
    email: { type: "string", format: "email", example: "sara@example.com" },
    role: { type: "string", enum: ["sales"], example: "sales" },
  },
};

const registerInput = {
  type: "object",
  required: ["name", "email", "password"],
  properties: {
    name: { type: "string", example: "Sara Sales" },
    email: { type: "string", format: "email", example: "sara@example.com" },
    password: { type: "string", format: "password", minLength: 8, example: "password123" },
  },
};

const loginInput = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string", format: "email", example: "sara@example.com" },
    password: { type: "string", format: "password", example: "password123" },
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
const notFound = { description: "Customer not found, or not owned by the logged-in user", content: json(ref("Error")) };
const unauthorized = { description: "Missing, invalid or expired token", content: json(ref("Error")) };
const authResponse = (description) => ({ description, content: json(ref("AuthResponse")) });
const badRequest = { description: "Invalid input", content: json(ref("Error")) };

export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "Customers API",
    version: "1.0.0",
    description:
      "CRUD operations on customers plus an AI agent endpoint that answers natural-language questions about customer data.\n\n" +
      "**Authentication:** call `POST /api/auth/register` or `POST /api/auth/login`, copy the `token` from the response, click **Authorize** and paste it. " +
      "Customer and agent endpoints require the token.\n\n" +
      "**Per-user access:** every customer belongs to one sales user. You only see and change your own customers, and the agent only works with them. " +
      "Another user's customer returns 404.",
  },
  // Relative, so "Try it out" targets whichever host serves the docs (localhost or the Vercel domain).
  servers: [{ url: "/" }],
  tags: [{ name: "Auth" }, { name: "Customers" }, { name: "Agent" }, { name: "Health" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      User: user,
      RegisterInput: registerInput,
      LoginInput: loginInput,
      AuthResponse: { type: "object", properties: { token: { type: "string" }, user: ref("User") } },
      Customer: customer,
      CustomerInput: customerInput,
      CustomerUpdate: { ...customerInput, required: [] },
      Error: error,
    },
  },
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new sales user",
        description: "New users always get the `sales` role. Returns a token you can use with **Authorize**.",
        requestBody: { required: true, content: json(ref("RegisterInput")) },
        responses: {
          201: authResponse("Registered"),
          400: badRequest,
          409: { description: "Email already registered", content: json(ref("Error")) },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in and get a token",
        requestBody: { required: true, content: json(ref("LoginInput")) },
        responses: {
          200: authResponse("Logged in"),
          400: badRequest,
          401: { description: "Invalid email or password", content: json(ref("Error")) },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the logged-in user",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Current user", content: json({ type: "object", properties: { user: ref("User") } }) }, 401: unauthorized },
      },
    },
    "/api/customers": {
      get: {
        tags: ["Customers"],
        summary: "List your customers, or search them by name",
        parameters: [
          { name: "name", in: "query", required: false, description: "Partial, case-insensitive name filter", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Customers", content: json({ type: "array", items: ref("Customer") }) } },
      },
      post: {
        tags: ["Customers"],
        summary: "Create a customer owned by you",
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
          "Claude answers using tools that list, search, add, update and delete the logged-in user's customers only. Pass previous turns in `history` for a multi-turn conversation.",
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
          503: { description: "ANTHROPIC_API_KEY or JWT_SECRET not configured", content: json(ref("Error")) },
        },
      },
    },
    "/api/health": {
      get: { tags: ["Health"], summary: "Health check (includes database connectivity)", responses: { 200: { description: "OK" } } },
    },
  },
};

// Customer and agent operations require a bearer token.
for (const path of ["/api/customers", "/api/customers/{id}", "/api/agent"]) {
  for (const [method, op] of Object.entries(swaggerSpec.paths[path])) {
    if (method === "parameters") continue;
    op.security = [{ bearerAuth: [] }];
    op.responses[401] = unauthorized;
  }
}

// Pinned to the swagger-ui-dist version previously bundled by swagger-ui-express.
const SWAGGER_UI_CDN = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.0";

export const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Customers API - Swagger UI</title>
    <link rel="icon" type="image/png" href="${SWAGGER_UI_CDN}/favicon-32x32.png" />
    <link rel="stylesheet" href="${SWAGGER_UI_CDN}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI_CDN}/swagger-ui-bundle.js" crossorigin></script>
    <script src="${SWAGGER_UI_CDN}/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/swagger.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
      });
    </script>
  </body>
</html>`;
