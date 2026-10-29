import { useState } from "react";
import { api } from "../api.js";

export default function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = isRegister
        ? await api.register({ name: name.trim(), email: email.trim(), password })
        : await api.login({ email: email.trim(), password });
      onAuthenticated(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isRegister ? "login" : "register");
    setError("");
  }

  return (
    <div className="auth-wrap">
      <div className="modal auth-card">
        <h3>{isRegister ? "Create your account" : "Log in"}</h3>
        <p className="muted">
          {isRegister ? "New accounts are sales users." : "Log in to see and manage your customers."}
        </p>

        <form onSubmit={submit}>
          {isRegister && (
            <label>
              Name
              <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </label>
          )}
          <label>
            Email
            <input
              autoFocus={!isRegister}
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              minLength={isRegister ? 8 : undefined}
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? "At least 8 characters" : ""}
            />
          </label>

          {error && <div className="alert error">{error}</div>}

          <button className="btn primary auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : isRegister ? "Register" : "Log in"}
          </button>
        </form>

        <p className="auth-switch muted">
          {isRegister ? "Already have an account?" : "No account yet?"}{" "}
          <button type="button" className="link" onClick={switchMode} disabled={busy}>
            {isRegister ? "Log in" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}
