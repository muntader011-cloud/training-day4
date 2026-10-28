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
