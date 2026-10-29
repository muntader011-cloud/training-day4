export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

const TOKEN_KEY = "customerHubToken";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode): the session lasts until reload.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

// Called when the server rejects the token, so the app can return to the login screen.
let unauthorizedHandler = () => {};
export const onUnauthorized = (handler) => {
  unauthorizedHandler = handler;
};

async function request(path, options = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach the API at ${API_URL}. Is the backend running?`);
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token) {
    clearToken();
    unauthorizedHandler();
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

async function authenticate(path, body) {
  const { token, user } = await request(path, { method: "POST", body });
  setToken(token);
  return user;
}

export const api = {
  register: (details) => authenticate("/api/auth/register", details),
  login: (credentials) => authenticate("/api/auth/login", credentials),
  me: () => request("/api/auth/me").then((data) => data.user),
  listCustomers: (name) => request(`/api/customers${name ? `?name=${encodeURIComponent(name)}` : ""}`),
  createCustomer: (customer) => request("/api/customers", { method: "POST", body: customer }),
  updateCustomer: (id, customer) => request(`/api/customers/${id}`, { method: "PUT", body: customer }),
  deleteCustomer: (id) => request(`/api/customers/${id}`, { method: "DELETE" }),
  askAgent: (message, history) => request("/api/agent", { method: "POST", body: { message, history } }),
  health: () => request("/api/health"),
};
