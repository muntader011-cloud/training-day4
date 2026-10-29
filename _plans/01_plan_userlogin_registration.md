# Plan 01: User Registration, Login and Per-User Customer Access

**Spec:** [`_specs/01_spec_userlogin_registration.md`](../_specs/01_spec_userlogin_registration.md)
**Status:** Implemented (2026-10-29)
**Date:** 2026-10-29

## 0. Prerequisites

- [ ] The project is a git repository (`git init` if not), and all current work is committed before implementation starts. This is required by the workflow in `CLAUDE.md`.
- [ ] `JWT_SECRET` is added to `backend/.env` locally (and later to Vercel).

## 1. Decisions on the spec's open questions

These defaults are used unless the user says otherwise:

| Question | Decision |
| -------- | -------- |
| Q1. Existing customers | Leave them unassigned (`sales_user_id = NULL`), so they are hidden. The migration script accepts an optional `ASSIGN_EXISTING_TO=<email>` environment variable that assigns them to that user once the user exists. |
| Q2. 404 or 403 | `404 Customer not found` for both missing customers and other users' customers. |
| Q3. Customer email uniqueness | Keep the existing constraint unchanged. Changing it to unique per owner is left as a follow-up. |

## 2. Backend

### 2.1 Dependencies

`cd backend && npm install bcryptjs jsonwebtoken`

### 2.2 Migration: `backend/sql/001_users_and_ownership.sql` (new)

```sql
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('sales')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS sales_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS customers_sales_user_id_idx ON customers (sales_user_id);
```

### 2.3 Migration runner: `backend/scripts/migrate.js` (new)

- Loads `dotenv/config`, reads every `backend/sql/*.sql` file in name order, and runs each one with `pool.query`.
- If `ASSIGN_EXISTING_TO` is set, runs `UPDATE customers SET sales_user_id = (SELECT id FROM users WHERE lower(email) = lower($1)) WHERE sales_user_id IS NULL`, and reports the row count or an error if the user is not found.
- Add `"migrate": "node scripts/migrate.js"` to `backend/package.json`.

### 2.4 Data layer: `backend/src/db.js`

- Add user functions:
  - `createUser({ name, email, passwordHash })`: inserts the user and returns `{ id, name, email, role }`.
  - `getUserByEmail(email)`: returns the user including `password_hash`, for login only.
  - `getUserById(id)`: returns `{ id, name, email, role }`.
- Change every customer function to take `userId` as the first argument and scope its SQL to the owner:
  - `getAllCustomers(userId)`: `WHERE sales_user_id = $1`
  - `getCustomerById(userId, id)`: `WHERE id = $2 AND sales_user_id = $1`
  - `searchCustomersByName(userId, name)`
  - `createCustomer(userId, { name, email })`: inserts `sales_user_id = userId`
  - `updateCustomer(userId, id, …)` and `deleteCustomer(userId, id)`: `WHERE id = $… AND sales_user_id = $…`
- Add `sales_user_id` to the selected and `RETURNING` columns.

Because every customer query requires `userId`, an unscoped query is not possible from the routes or the agent.

### 2.5 Auth helpers: `backend/src/auth.js` (new)

- `hashPassword(pw)` and `verifyPassword(pw, hash)` using bcryptjs (cost 10).
- `signToken(user)`: HS256 token, `expiresIn: process.env.JWT_EXPIRES_IN || "8h"`, payload `{ sub, role, name, email }`.
- `requireAuth` middleware:
  - If `JWT_SECRET` is missing, raises an error with `status = 503`.
  - Reads `Authorization: Bearer …`. A missing, invalid or expired token gives `401 { error: "Authentication required" }`.
  - On success sets `req.user = { id: Number(sub), role, name, email }`.

### 2.6 Auth routes: `backend/src/routes/auth.js` (new)

- `POST /register`:
  - Validates `name`, `email` (the `EMAIL_RE` regex, moved to a shared spot in `auth.js`) and `password` (at least 8 characters).
  - Lower-cases the email and ignores any `role` in the body.
  - Returns `201 { token, user }`. A duplicate email hits the existing `23505` handler in `app.js`, so change that handler's message to a neutral "already exists" message that works for both users and customers.
- `POST /login`: compares the password with bcrypt. A wrong password or unknown email gives the same `401 { error: "Invalid email or password" }`. Success returns `200 { token, user }`.
- `GET /me`: protected by `requireAuth`. Returns `{ user }` from `getUserById`, or `401` if the user no longer exists.

### 2.7 Wiring: `backend/src/app.js`

```js
app.use("/api/auth", authRouter);
app.use("/api/customers", requireAuth, customersRouter);
app.use("/api/agent", requireAuth, agentRouter);
```

`/api/health`, `/swagger` and `/swagger.json` stay public.

### 2.8 Customer routes: `backend/src/routes/customers.js`

- Pass `req.user.id` into every `db.*` call. Validation and response shapes stay the same.

### 2.9 Agent: `backend/src/agent.js` and `backend/src/routes/agent.js`

- Change the signature to `runAgent(history, user)`. `executeTool(name, input, userId)` passes `userId` to every `db` call.
- Build the system prompt per request: append "You are assisting sales user {name} ({email}). You can only see and change this user's customers."
- No changes to tool schemas. The model never supplies an owner.
- `routes/agent.js` calls `runAgent([...], req.user)`.

### 2.10 Startup warning: `backend/src/server.js`

- Warn when `JWT_SECRET` is not set, like the existing `ANTHROPIC_API_KEY` warning.

### 2.11 Swagger: `backend/src/swagger.js`

- `components.securitySchemes.bearerAuth = { type: "http", scheme: "bearer", bearerFormat: "JWT" }`.
- New schemas:
  - `RegisterInput`, `LoginInput`, `User` and `AuthResponse` (`{ token, user }`).
  - Add `sales_user_id` (read-only) to `Customer`.
- New `Auth` tag and paths:
  - `/api/auth/register` (responses 201, 400, 409)
  - `/api/auth/login` (responses 200, 400, 401)
  - `/api/auth/me` (secured; responses 200, 401)
- Add `security: [{ bearerAuth: [] }]` and a shared `401` response to every customer and agent operation. Update the customer `404` description to "not found or not owned by you".
- Update `info.description`: auth flow (register or login → Authorize → paste token) and the per-user access rule.
- In `swaggerHtml`, set `persistAuthorization: true` so the token survives a page reload.

### 2.12 Config and docs

- Add `JWT_SECRET=change-me-to-a-long-random-string` and `JWT_EXPIRES_IN=8h` to `backend/.env.example`.
- README:
  - Add `JWT_SECRET` to the Vercel environment table.
  - Replace "There is no authentication" with an auth section.
  - Add `npm run migrate` to the backend setup steps.
  - Add the new endpoints.
- `CLAUDE.md`: update the Architecture section (auth middleware, user-scoped `db.js`, migration command).

## 3. Frontend

### 3.1 `frontend/src/api.js`

- Token helpers: `getToken`, `setToken` and `clearToken`, using `localStorage` with each call wrapped in try/catch.
- `request()` adds `Authorization: Bearer <token>` when a token exists. On `401` it clears the token and calls the registered `onUnauthorized` callback (set by `App`), then throws.
- New calls: `register({ name, email, password })`, `login({ email, password })` and `me()`. The `register` and `login` calls store the returned token.

### 3.2 `frontend/src/components/AuthPanel.jsx` (new)

- One component with a login/register toggle.
  - Login fields: email and password.
  - Register fields: name, email and password (minimum 8 characters).
- Shows server error messages. On success it calls `onAuthenticated(user)`.
- Reuses the existing form, input and button classes from `styles.css`, adding a few rules for the centred auth card.

### 3.3 `frontend/src/App.jsx`

- `user` state:
  - On mount, if a token exists, call `api.me()`, setting `user` on success and clearing the token on failure.
  - While that check runs, show a loading state.
- Render `AuthPanel` when `user` is null. Otherwise render the existing tabs.
- Top bar: show the user's name and a **Log out** button. Log out clears the token, sets `user` to null and remounts the panels by giving them `key={user.id}`, so the next user starts with fresh customer and chat state.
- Register `api.onUnauthorized(() => setUser(null))`.
- Health and Swagger links stay as they are.

`CustomersPanel`, `CustomerModal` and `ChatPanel` need no changes. Their data is already scoped by the server.

## 4. Implementation order

1. Commit the current state (prerequisite).
2. Backend dependencies, then the SQL migration and `npm run migrate`. Run it against the database.
3. `auth.js`, then the `db.js` user functions, then `routes/auth.js` and the wiring in `app.js`.
4. Scope `db.js` customer functions, `routes/customers.js` and the agent.
5. Swagger updates.
6. Frontend: `api.js`, `AuthPanel`, `App.jsx` and styles.
7. Docs: `.env.example`, README and `CLAUDE.md`.
8. Verification (section 5).

## 5. Verification

There is no test suite, so verify manually against the spec's acceptance criteria (spec §11). Run the backend with `npm run dev`.

**curl / Swagger script (two users):**

1. Register A, then register B. Both return `201`, and `role` is `sales` even when `"role":"admin"` is sent.
2. Register A again with an upper-case email. Expect `409`.
3. Log in A with a wrong password and log in with an unknown email. Both give the identical `401`.
4. `GET /api/customers` with no token, with a tampered token, and with a token signed with `expiresIn: "1s"` after it expires. Expect `401` each time.
5. A creates a customer. B's list does not contain it. B's `GET`, `PUT` and `DELETE /api/customers/<A's id>` return `404`. A's `GET` confirms the record is unchanged.
6. `POST /api/agent` as B with "list all customers" and "delete customer <A's id>". The reply shows only B's data, and A's customer still exists.
7. No response body anywhere contains `password_hash`.
8. Repeat steps 1, 5 and 6 using only the Swagger UI's **Authorize** button.

**Frontend:**

- Register, log in, log out and log back in as a different user. The table and chat show only the current user's customers.
- Delete the token from localStorage while on the page, then take any action. The app returns to the login screen.
- Run `npm run build` to confirm the frontend compiles.

## 6. Risks and notes

- **Existing customers become invisible** after the migration until `ASSIGN_EXISTING_TO` is used. Mention this in the README.
- **The existing unique constraint on customers** may block user B from adding a customer email that user A already has. The error is a `409` and reveals that the email exists elsewhere. This is accepted for now (Q3).
- **`localStorage` tokens** can be read by any script on the page if it has an XSS hole. This is acceptable for this training app; httpOnly cookies are a possible later improvement.
- **Vercel:** the setup is stateless JWT with no extra infrastructure. `JWT_SECRET` must be set on the backend project before deploying.
