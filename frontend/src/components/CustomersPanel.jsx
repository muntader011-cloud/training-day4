import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import CustomerModal from "./CustomerModal.jsx";

export default function CustomersPanel({ dataVersion }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // { mode: "create" | "edit" | "delete", customer? }
  const [toast, setToast] = useState(null);

  const load = useCallback(async (name) => {
    setLoading(true);
    setError("");
    try {
      setCustomers(await api.listCustomers(name));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search, load, dataVersion]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSave(values) {
    if (modal.mode === "create") {
      const c = await api.createCustomer(values);
      setToast({ type: "success", text: `Added ${c.name}` });
    } else {
      const c = await api.updateCustomer(modal.customer.id, values);
      setToast({ type: "success", text: `Updated ${c.name}` });
    }
    setModal(null);
    load(search.trim());
  }

  async function handleDelete() {
    await api.deleteCustomer(modal.customer.id);
    setToast({ type: "success", text: `Deleted ${modal.customer.name}` });
    setModal(null);
    load(search.trim());
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Customers</h2>
          <p className="muted">{loading ? "Loading…" : `${customers.length} record${customers.length === 1 ? "" : "s"}`}</p>
        </div>
        <div className="toolbar">
          <div className="search">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M10 2a8 8 0 105.3 14l5.4 5.3 1.4-1.4-5.3-5.4A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z" />
            </svg>
            <input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn ghost" onClick={() => load(search.trim())} title="Refresh">
            Refresh
          </button>
          <button className="btn primary" onClick={() => setModal({ mode: "create" })}>
            + Add customer
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th style={{ width: 170 }} className="right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && customers.length === 0 ? (
              [0, 1, 2].map((i) => (
                <tr key={i} className="skeleton">
                  <td colSpan={4}>
                    <span />
                  </td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty">
                  {search ? `No customers match "${search}".` : "No customers yet. Add the first one."}
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id}>
                  <td className="muted">#{c.id}</td>
                  <td>
                    <div className="person">
                      <span className="avatar">{initials(c.name)}</span>
                      {c.name}
                    </div>
                  </td>
                  <td>
                    <a href={`mailto:${c.email}`}>{c.email}</a>
                  </td>
                  <td className="right">
                    <button className="btn small ghost" onClick={() => setModal({ mode: "edit", customer: c })}>
                      Edit
                    </button>
                    <button className="btn small danger-ghost" onClick={() => setModal({ mode: "delete", customer: c })}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <CustomerModal
          mode={modal.mode}
          customer={modal.customer}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}
    </section>
  );
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
