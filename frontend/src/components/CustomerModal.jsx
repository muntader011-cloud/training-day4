import { useEffect, useState } from "react";

export default function CustomerModal({ mode, customer, onClose, onSave, onDelete }) {
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const isDelete = mode === "delete";
  const title = isDelete ? "Delete customer" : mode === "create" ? "Add customer" : "Edit customer";

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 id="modal-title">{title}</h3>

        {isDelete ? (
          <p>
            Are you sure you want to delete <strong>{customer.name}</strong> ({customer.email})? This cannot be undone.
          </p>
        ) : (
          <form
            id="customer-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => onSave({ name: name.trim(), email: email.trim() }));
            }}
          >
            <label>
              Name
              <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </label>
          </form>
        )}

        {error && <div className="alert error">{error}</div>}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {isDelete ? (
            <button className="btn danger" onClick={() => run(onDelete)} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </button>
          ) : (
            <button className="btn primary" type="submit" form="customer-form" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
