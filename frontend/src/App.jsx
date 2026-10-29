import { useEffect, useState } from "react";
import CustomersPanel from "./components/CustomersPanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import AuthPanel from "./components/AuthPanel.jsx";
import { api, API_URL, getToken, clearToken, onUnauthorized } from "./api.js";

export default function App() {
  const [tab, setTab] = useState("customers");
  const [health, setHealth] = useState(null);
  // undefined = still checking a stored token, null = logged out.
  const [user, setUser] = useState(() => (getToken() ? undefined : null));
  // Bumped when the agent may have changed data, so the table reloads.
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: "down" }));
  }, []);

  useEffect(() => {
    onUnauthorized(() => setUser(null));
    if (getToken()) {
      api.me().then(setUser).catch(() => {
        clearToken();
        setUser(null);
      });
    }
  }, []);

  function logout() {
    clearToken();
    setUser(null);
    setTab("customers");
  }

  const online = health?.status === "ok";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">C</div>
          <div>
            <h1>Customer Hub</h1>
            <p>Manage customers and ask questions in plain English</p>
          </div>
        </div>
        <div className="topbar-right">
          <span className={`status ${online ? "ok" : health ? "down" : ""}`}>
            <span className="dot" />
            {health === null ? "Checking API…" : online ? "API connected" : "API offline"}
          </span>
          <a className="btn ghost" href={`${API_URL}/swagger`} target="_blank" rel="noreferrer">
            Swagger docs
          </a>
          {user && (
            <>
              <span className="user-name">{user.name}</span>
              <button className="btn ghost" onClick={logout}>
                Log out
              </button>
            </>
          )}
        </div>
      </header>

      {user === undefined ? (
        <p className="muted">Checking your session…</p>
      ) : user === null ? (
        <AuthPanel onAuthenticated={setUser} />
      ) : (
        // Keyed by user so a different login starts with fresh customer and chat state.
        <div key={user.id}>
          <nav className="tabs">
            <button className={tab === "customers" ? "active" : ""} onClick={() => setTab("customers")}>
              Customers
            </button>
            <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
              AI Assistant
            </button>
          </nav>

          <main className="content">
            <div hidden={tab !== "customers"}>
              <CustomersPanel dataVersion={dataVersion} />
            </div>
            <div hidden={tab !== "chat"}>
              <ChatPanel agentEnabled={health?.agent !== false} onDataChanged={() => setDataVersion((v) => v + 1)} />
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
