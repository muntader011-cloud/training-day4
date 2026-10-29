# Spec 01: User Registration, Login and Per-User Customer Access

**Status:** Implemented (2026-10-29)
**Date:** 2026-10-29

## 1. Background

Customer Hub currently has no authentication. Every caller can read and change every customer, both through the REST API (`/api/customers`) and through the AI agent (`/api/agent`).

This feature adds user accounts. Each customer belongs to one sales user, and a logged-in user can only see and manage their own customers.

## 2. Goals

1. A new user can register. A new user's role is `sales` by default.
2. A registered user can log in and receives an access token.
3. Every customer is associated with exactly one sales user (the owner).
4. A logged-in user can only list, view, create, update and delete their own customers. CRUD behaviour is otherwise unchanged.
5. The AI agent only reads and changes the logged-in user's customers.
6. Any attempt to access or modify a customer owned by another user is denied.
7. Swagger documents the new endpoints and the authentication scheme. The whole flow can be tested from the Swagger UI ("Authorize" button) or with plain API calls.

## 3. Non-goals

- Admin or manager roles, or any user who can see all customers. The `role` column is added now so these can come later.
- Password reset, email verification, refresh tokens, account deletion and profile editing.
- Reassigning customers between sales users.
- Rate limiting of login attempts.

## 4. Data model

### 4.1 New table `users`

| Column          | Type          | Constraints                                   |
| --------------- | ------------- | --------------------------------------------- |
| `id`            | `SERIAL`      | primary key                                   |
| `name`          | `TEXT`        | not null                                      |
| `email`         | `TEXT`        | not null, unique (case-insensitive)           |
| `password_hash` | `TEXT`        | not null (bcrypt)                             |
| `role`          | `TEXT`        | not null, default `'sales'`, check `role IN ('sales')` |
| `created_at`    | `TIMESTAMPTZ` | not null, default `now()`                     |

### 4.2 Changes to `customers`

- Add `sales_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT`.
- Add an index on `sales_user_id`.
- Existing customers keep `sales_user_id = NULL` and are not visible to anyone until they are assigned (see Open question Q1).
- New customers always get `sales_user_id` set to the logged-in user's id. The client can never set or change it.

### 4.3 Migration

The repository has no migration tooling today. Add an idempotent SQL script (`backend/sql/001_users_and_ownership.sql`) and an npm script (`npm run migrate`) that runs it against `DATABASE_URL`. It must be safe to run more than once (`IF NOT EXISTS`).

## 5. Authentication

- **Passwords** are hashed with bcrypt (`bcryptjs`, cost 10). They are never returned or logged.
- **Tokens** are JWTs (`jsonwebtoken`, HS256), signed with a new `JWT_SECRET` environment variable and valid for 8 hours (`JWT_EXPIRES_IN`, default `8h`). Payload: `{ sub: <user id>, role, name, email }`.
- **Transport:** clients send `Authorization: Bearer <token>`. No cookies, so CORS stays as it is.
- **Statelessness:** the backend keeps no session store, which suits Vercel serverless functions. Logout happens on the client by deleting the token.
- If `JWT_SECRET` is missing, the server refuses protected requests with `503` (same pattern as a missing `ANTHROPIC_API_KEY`) and logs a startup warning.

## 6. API

### 6.1 New endpoints (public)

| Method | Path                 | Body                         | Success                                  | Errors |
| ------ | -------------------- | ---------------------------- | ---------------------------------------- | ------ |
| POST   | `/api/auth/register` | `{ name, email, password }`  | `201 { token, user }`                    | `400` invalid input, `409` email already registered |
| POST   | `/api/auth/login`    | `{ email, password }`        | `200 { token, user }`                    | `400` missing fields, `401` invalid email or password |

### 6.2 New endpoint (protected)

| Method | Path           | Success              | Errors |
| ------ | -------------- | -------------------- | ------ |
| GET    | `/api/auth/me` | `200 { user }`       | `401`  |

`user` is always `{ id, name, email, role }`.

**Validation:** `name` is a non-empty string. `email` matches the existing email regex and is stored lower-cased. `password` has at least 8 characters. Registration ignores any `role` in the body; every new user is `sales`.

### 6.3 Changes to existing endpoints

- All `/api/customers` routes and `POST /api/agent` require a valid token. Without one, or with an invalid or expired token, they return `401 { error }`.
- `GET /api/customers` (including `?name=`) returns only the caller's customers.
- `POST /api/customers` creates the customer owned by the caller.
- `GET`, `PUT` and `DELETE /api/customers/:id` return `404 Customer not found` when the customer does not exist **or** belongs to another user. Using the same response stops callers from discovering other users' customer ids (see Open question Q2).
- The request and response shapes for customers do not change. Responses may add `sales_user_id`.
- `GET /api/health`, `/swagger` and `/swagger.json` stay public.

### 6.4 Enforcement rule

Ownership is enforced in the data layer, not only in the route handlers. Every customer function in `db.js` takes the user id and adds `AND sales_user_id = $userId` to its SQL. The REST routes and the agent tools share these functions, so they cannot drift apart.

## 7. AI agent

- `POST /api/agent` requires a token. The route passes the authenticated user's id to `runAgent`.
- Every tool runs through the user-scoped `db.js` functions. The model never receives or chooses the user id; tool input schemas do not change and contain no owner field.
- `get_customer_by_id`, `update_customer` and `delete_customer` on another user's customer return the same "No customer with id N" result as a missing customer.
- The system prompt adds that the assistant is working for the named sales user and can only see that user's customers.

## 8. Swagger

- Add a `bearerAuth` security scheme (`type: http`, `scheme: bearer`, `bearerFormat: JWT`) so the UI shows an **Authorize** button.
- Add an `Auth` tag with `register`, `login` and `me`, including request examples.
- Mark all customer and agent operations with `security: [{ bearerAuth: [] }]` and document the `401` response.
- Update the API description to say that the API now has per-user access control and how to get a token.
- Add `sales_user_id` to the `Customer` schema.

**Swagger test flow:** register → copy `token` → Authorize → call the customer endpoints. A second registered user must not see the first user's customers.

## 9. Frontend

- When there is no token, show a **Login** screen with a link to a **Register** screen. The existing tabs are only shown when logged in.
- Store the token in `localStorage`. `api.js` adds the `Authorization` header to every request.
- On any `401` response, clear the token and return to the login screen.
- The top bar shows the logged-in user's name and a **Log out** button.
- On load, if a token exists, call `GET /api/auth/me` to confirm it is valid.

## 10. Configuration

Add to `backend/.env.example`, the README and the Vercel environment variables:

- `JWT_SECRET`: a long random string. Required.
- `JWT_EXPIRES_IN`: optional, default `8h`.

## 11. Acceptance criteria

1. Registering with a new email returns `201` with a token, and the user's role is `sales`, even if the request asks for another role.
2. Registering with an email that already exists (in any letter case) returns `409`.
3. Logging in with a wrong password or an unknown email returns the same `401` message.
4. Calling any customer or agent endpoint without a token, or with an expired or tampered token, returns `401`.
5. User A creates a customer. User B's `GET /api/customers` does not include it.
6. User B's `GET`, `PUT` or `DELETE` on user A's customer id returns `404`, and the record is unchanged.
7. User B asks the agent "list all customers" and "delete customer <A's id>". The agent shows only B's customers and does not delete A's customer.
8. All of the above can be done from the Swagger UI using the Authorize button.
9. The frontend login, register and logout flow works, and the customer table and chat only show the logged-in user's data.
10. `password_hash` never appears in any API response.

## 12. Open questions

- **Q1. Existing customers:** customers created before this feature have no owner. Proposal: leave them unassigned and hidden, and let the migration optionally assign them to a given user email. Alternative: assign them all to the first registered user.
- **Q2. 404 or 403:** this spec returns `404` for another user's customer so their ids are not revealed. Say so if you would rather return `403 Forbidden`.
- **Q3. Customer email uniqueness:** today, customer emails appear to be unique across the whole table. Should two sales users be able to have a customer with the same email (unique per owner instead)?
