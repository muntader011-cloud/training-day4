# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Customer Hub: two independent npm projects in one repo (no root `package.json`, no workspaces).

- `backend/` — Express 5 REST API (ES modules) over PostgreSQL (`pg`), Swagger UI, and a Claude tool-use agent endpoint. Port 3000.
- `frontend/` — React 19 + Vite SPA. Port 5173 (`strictPort`).

## Workflow: spec-driven development

1. **Spec:** write the spec for a change in `_specs/` and wait for the user to approve it.
2. **Plan:** after the spec is approved, write the implementation plan in `_plans/`.
3. **Commit first:** before starting implementation, make sure all work on the current branch is committed (clean `git status`).
4. **Implement** according to the approved plan.

## Commands

Run each from its own directory after `npm install`:

```powershell
# backend
npm start        # node src/server.js
npm run dev      # node --watch src/server.js
npm run migrate  # apply backend/sql/*.sql to DATABASE_URL (idempotent)

# frontend
npm run dev      # Vite dev server on :5173
npm run build    # output to frontend/dist
npm run preview
```

There is no test suite, linter, or formatter configured in either project.

## Configuration

- `backend/.env` (template: `.env.example`): `PORT`, `DATABASE_URL`, `CORS_ORIGIN` (comma-separated or `*`), `ANTHROPIC_API_KEY`, `JWT_SECRET`, optional `JWT_EXPIRES_IN` (default `8h`), `ANTHROPIC_MODEL` (default `claude-opus-5-5`) and `AGENT_EFFORT` (default `low`).
- `frontend/.env`: `VITE_API_URL` (no trailing slash). Read at build time.
- `.env*` files (except `.env.example`) and `Prompt.txt` (contains a DB connection string) are gitignored. Do not commit them.
- The DB pool always uses `ssl: { rejectUnauthorized: false }` (hosted Render Postgres). The `customers(id, name, email)` table predates the code; `sql/001_users_and_ownership.sql` adds `users` and `customers.sales_user_id`. Add schema changes as new numbered files in `backend/sql/`. Unique violations (`23505`, e.g. duplicate user email or the global `customers.email` unique constraint) map to HTTP 409 in `app.js`.

## Architecture

### Backend

- **Two entry points, one app.** `src/app.js` builds and exports the Express app. `src/server.js` calls `listen()` for local use only. `api/index.js` re-exports the app as a Vercel serverless function, and `vercel.json` rewrites every path to it. Put middleware and routes in `app.js`, never in `server.js`.
- **Auth:** `src/auth.js` has bcrypt hashing, JWT signing and the `requireAuth` middleware, which sets `req.user = { id, role, name, email }`. `app.js` mounts `routes/auth.js` publicly and puts `requireAuth` in front of `/api/customers` and `/api/agent`. `/api/health` and Swagger stay public.
- **`src/db.js` is the single data-access layer, and it enforces per-user access.** Every customer function takes the owner's `userId` first and filters on `sales_user_id`. Both the REST routes (`routes/customers.js`, passing `req.user.id`) and the agent tools (`agent.js`) call these functions, so keep ownership checks in the SQL, not in the callers. `null` means "not found or not yours", which the API returns as 404.
- **Error handling** relies on Express 5 forwarding rejected promises from async handlers to the final error middleware in `app.js`. Route handlers don't need try/catch unless they translate specific errors (`routes/agent.js` maps Anthropic SDK errors to 429/502/503).
- **Agent (`src/agent.js`)** runs a manual tool-use loop (max 8 rounds) with `anthropic.beta.messages.create`, using `ANTHROPIC_MODEL` and `AGENT_EFFORT`, adaptive thinking, and the server-side fallback beta (skipped for Haiku models, which don't support it). `runAgent(history, user)` scopes every tool to `user.id` and adds the user to the system prompt. The model never supplies an owner id. Each tool in the `tools` array maps to a `db.js` call in `executeTool`. To add a capability, add the tool definition, a `case` in `executeTool`, and usually a `db.js` function. The endpoint is stateless: the client sends plain-text `history` (`{role, content}` strings only) on every request, and the response returns `{ reply, toolCalls }`. A missing API key throws an error with `status = 503`.
- **Swagger** (`src/swagger.js`) is a hand-written OpenAPI 3 object, not generated from the routes. Update it when you change endpoints. It defines a `bearerAuth` scheme, and a loop at the end adds `security` and a 401 response to the customer and agent paths. UI assets load from jsDelivr, and `servers: [{ url: "/" }]` is relative so the spec works on both localhost and Vercel.
- **CORS:** the `CORS_ORIGIN` list, plus any `https://*.vercel.app` origin, is always allowed.

### Frontend

- `src/api.js` is the only place that talks to the backend (a `request()` wrapper that throws `Error` with the server's `error` message). It keeps the JWT in `localStorage`, sends it as a bearer header, and on a 401 clears it and calls the `onUnauthorized` handler.
- `App.jsx` shows `AuthPanel` (login/register) until a user is known. It checks a stored token with `api.me()` on load. The logged-in view is keyed by `user.id`, so switching users resets panel state.
- `App.jsx` holds the tabs (`CustomersPanel` for CRUD, `ChatPanel` for the agent) and a `dataVersion` counter. ChatPanel bumps it after agent replies so CustomersPanel reloads, because the agent can mutate data. Both panels stay mounted (hidden with `hidden`) to keep their state.
- Chat replies render as markdown via `react-markdown` + `remark-gfm`.

## Deployment

The app deploys to Vercel as two projects from the same repo, with Root Directory `backend` (preset Other, no build command) and `frontend` (preset Vite). Deploy the backend first, then set `VITE_API_URL` on the frontend and `CORS_ORIGIN` on the backend. See README.md for details.
