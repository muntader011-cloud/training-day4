# Customer Hub

Two projects:

| Project     | Stack                                              | Port |
| ----------- | -------------------------------------------------- | ---- |
| `backend/`  | Node.js, Express, PostgreSQL (`pg`), Swagger UI, Anthropic SDK | 3000 |
| `frontend/` | React + Vite                                       | 5173 |

## Backend

```powershell
cd backend
npm install
# copy .env.example to .env and set DATABASE_URL, ANTHROPIC_API_KEY and JWT_SECRET
npm run migrate   # creates the users table and customers.sales_user_id (safe to re-run)
npm start
```

- Swagger UI: http://localhost:3000/swagger
- `POST /api/auth/register` (`{ name, email, password }`), `POST /api/auth/login` (`{ email, password }`) and `GET /api/auth/me`. Register and login return `{ token, user }`.
- `GET/POST /api/customers`, `GET/PUT/DELETE /api/customers/:id`, `GET /api/customers?name=...`
- `POST /api/agent` with `{ "message": "Get all customers", "history": [] }`: Claude (`ANTHROPIC_MODEL`, default `claude-opus-5-5`) answers using tools
  `get_all_customers`, `get_customer_by_name`, `get_customer_by_id`, `add_customer`, `update_customer`, `delete_customer`.
- `GET /api/health`: checks the database connection and whether the agent is configured.
- CORS: allowed origins come from `CORS_ORIGIN` in `.env` (comma-separated, or `*`).
- **Authentication:** customer and agent endpoints need `Authorization: Bearer <token>`. New users always get the `sales` role.
- **Per-user access:** each customer belongs to one sales user (`customers.sales_user_id`). Users only see and change their own customers, and the agent only uses theirs. Another user's customer returns 404.
- **Testing in Swagger:** call register or login, copy the `token`, click **Authorize**, paste it, then use the customer and agent endpoints.
- **Existing customers** created before authentication have no owner and are hidden. To give them to one user, run `ASSIGN_EXISTING_TO=<user email> npm run migrate` after that user registers.
- Optional agent settings: `ANTHROPIC_MODEL` (default `claude-opus-5-5`) and `AGENT_EFFORT` (default `low`).

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and register or log in. The **Customers** tab handles CRUD. The **AI Assistant** tab is the natural-language chat.
The backend URL is set by `VITE_API_URL` in `frontend/.env`.

## Deploying to Vercel

Create **two Vercel projects** from this repository. Each one uses a different **Root Directory**.

### 1. Backend (deploy first)

| Setting          | Value                         |
| ---------------- | ----------------------------- |
| Root Directory   | `backend`                     |
| Framework Preset | Other                         |
| Build Command    | _(leave empty)_               |

Environment variables:

| Name                | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`      | your PostgreSQL connection string                             |
| `ANTHROPIC_API_KEY` | your Anthropic API key                                        |
| `JWT_SECRET`        | a long random string used to sign login tokens                |
| `CORS_ORIGIN`       | the frontend URL, e.g. `https://your-frontend.vercel.app` (set it after step 2, then redeploy) |

How it runs: `backend/vercel.json` rewrites every path to `api/index.js`. That file exports the Express app from `src/app.js` as a serverless function, while `src/server.js` is only used locally. Swagger UI assets load from jsDelivr, and the spec is served at `/swagger.json` with a relative server URL. As a result, `https://<backend>.vercel.app/swagger` works with nothing from `node_modules` bundled.

### 2. Frontend

| Setting          | Value      |
| ---------------- | ---------- |
| Root Directory   | `frontend` |
| Framework Preset | Vite       |

Environment variable: `VITE_API_URL` = the backend URL, e.g. `https://your-backend.vercel.app` (no trailing slash).
Vite reads it at build time, so redeploy the frontend whenever you change it.
