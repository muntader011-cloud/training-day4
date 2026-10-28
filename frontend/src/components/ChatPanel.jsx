import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api.js";

const SUGGESTIONS = [
  "Get all customers",
  "Find the customer named Sara",
  "Add a customer named John Smith with email john@example.com",
  "How many customers have an example.com email?",
];

const MUTATING_TOOLS = new Set(["add_customer", "update_customer", "delete_customer"]);

export default function ChatPanel({ agentEnabled, onDataChanged }) {
  const [messages, setMessages] = useState([]); // { role, content, toolCalls?, error? }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const { reply, toolCalls } = await api.askAgent(message, history);
      setMessages((prev) => [...prev, { role: "assistant", content: reply, toolCalls }]);
      if (toolCalls?.some((t) => MUTATING_TOOLS.has(t.name))) onDataChanged();
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: err.message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card chat">
      <div className="card-header">
        <div>
          <h2>AI Assistant</h2>
          <p className="muted">Ask about customers, or tell it to add, update or delete one.</p>
        </div>
        {messages.length > 0 && (
          <button className="btn ghost" onClick={() => setMessages([])} disabled={busy}>
            New chat
          </button>
        )}
      </div>

      {!agentEnabled && (
        <div className="alert warn">
          The backend has no <code>ANTHROPIC_API_KEY</code> configured. Add it to <code>backend/.env</code> and restart the
          server.
        </div>
      )}

      <div className="chat-log">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">✦</div>
            <h3>How can I help?</h3>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`bubble-row ${m.role}`}>
            <div className={`bubble ${m.role} ${m.error ? "error" : ""}`}>
              {m.role === "assistant" && !m.error ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              ) : (
                m.content
              )}
              {m.toolCalls?.length > 0 && (
                <div className="tool-calls">
                  {m.toolCalls.map((t, j) => (
                    <span key={j} className="tool-chip" title={JSON.stringify(t.input)}>
                      ⚙ {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="bubble-row assistant">
            <div className="bubble assistant typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Show me all customers"
          disabled={busy}
        />
        <button className="btn primary" type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
