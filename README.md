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
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm start
```

- Swagger UI: http://localhost:3000/swagger
- `GET/POST /api/customers`, `GET/PUT/DELETE /api/customers/:id`, `GET /api/customers?name=...`
- `POST /api/agent` with `{ "message": "Get all customers", "history": [] }`: Claude (`claude-opus-5-5`) answers using tools
  `get_all_customers`, `get_customer_by_name`, `get_customer_by_id`, `add_customer`, `update_customer`, `delete_customer`.
- `GET /api/health`: checks the database connection and whether the agent is configured.
- CORS: allowed origins come from `CORS_ORIGIN` in `.env` (comma-separated, or `*`).
- There is no authentication.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The **Customers** tab handles CRUD. The **AI Assistant** tab is the natural-language chat.
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
| `CORS_ORIGIN`       | the frontend URL, e.g. `https://your-frontend.vercel.app` (set it after step 2, then redeploy) |

How it runs: `backend/vercel.json` rewrites every path to `api/index.js`. That file exports the Express app from `src/app.js` as a serverless function, while `src/server.js` is only used locally. Swagger UI assets load from jsDelivr, and the spec is served at `/swagger.json` with a relative server URL. As a result, `https://<backend>.vercel.app/swagger` works with nothing from `node_modules` bundled.

### 2. Frontend

| Setting          | Value      |
| ---------------- | ---------- |
| Root Directory   | `frontend` |
| Framework Preset | Vite       |

Environment variable: `VITE_API_URL` = the backend URL, e.g. `https://your-backend.vercel.app` (no trailing slash).
Vite reads it at build time, so redeploy the frontend whenever you change it.
