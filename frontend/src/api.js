export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach the API at ${API_URL}. Is the backend running?`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  listCustomers: (name) => request(`/api/customers${name ? `?name=${encodeURIComponent(name)}` : ""}`),
  createCustomer: (customer) => request("/api/customers", { method: "POST", body: customer }),
  updateCustomer: (id, customer) => request(`/api/customers/${id}`, { method: "PUT", body: customer }),
  deleteCustomer: (id) => request(`/api/customers/${id}`, { method: "DELETE" }),
  askAgent: (message, history) => request("/api/agent", { method: "POST", body: { message, history } }),
  health: () => request("/api/health"),
};
