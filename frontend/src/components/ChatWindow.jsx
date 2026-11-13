import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { chatService } from "../services/chatService";
import { getErrorMessage } from "../services/api";
import { SUGGESTED_QUESTIONS } from "../utils/constants";
import MessageBubble from "./MessageBubble";
import ErrorBanner from "./ErrorBanner";
import Spinner from "./Spinner";

export default function ChatWindow({ sessionId, onSessionUpdated }) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await chatService.getSession(sessionId);
      setSession(data);
      setMessages(data.messages);
    } catch (err) {
      setSession(null);
      setError(getErrorMessage(err, "Could not load this conversation."));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const send = async (text) => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError("");
    setInput("");
    // Show the question immediately; replaced by the saved copy when the server answers.
    const pending = { id: `pending-${Date.now()}`, role: "user", content, created_at: new Date().toISOString() };
    setMessages((m) => [...m, pending]);
    try {
      const res = await chatService.sendMessage(sessionId, content);
      setMessages((m) => [...m.filter((x) => x.id !== pending.id), res.user_message, res.assistant_message]);
      setSession((s) => ({ ...s, ...res.session }));
      onSessionUpdated?.(res.session);
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== pending.id));
      setInput(content); // let the user retry without retyping
      setError(getErrorMessage(err, "The AI could not answer. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e) => { e.preventDefault(); send(input); };
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  if (loading) return <div className="flex flex-1 items-center justify-center text-ink-500"><Spinner size={28} /></div>;
  if (!session) {
    return <div className="flex-1 p-6"><ErrorBanner message={error || "Conversation not found."} onRetry={loadSession} /></div>;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Chat">
      <header className="border-b border-ink-200 bg-white px-5 py-3">
        <h2 className="truncate font-serif text-lg font-bold">{session.title}</h2>
        {session.article_id ? (
          <Link to={`/news/${session.article_id}`} className="text-xs font-semibold text-brand-700 hover:underline">
            About: {session.article_title}
          </Link>
        ) : (
          <p className="text-xs text-ink-500">General conversation (no article attached)</p>
        )}
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto bg-ink-50 p-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl text-center">
            <p className="mb-4 text-sm text-ink-500">
              {session.article_id ? "Ask anything about this article. Try one of these:" : "Ask a general question:"}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button key={q} className="rounded-full border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-brand-600 hover:text-brand-700" onClick={() => send(q)} disabled={sending}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-ink-500" role="status" aria-label="AI is typing">
            <Spinner size={16} /> Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-ink-200 bg-white p-4">
        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <textarea
            className="input max-h-40 min-h-[44px] resize-y"
            rows={1}
            placeholder="Ask a question about this news…"
            aria-label="Your message"
            maxLength={2000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
          />
          <button type="submit" className="btn-primary h-[44px]" disabled={sending || !input.trim()} aria-label="Send message">
            <Send size={16} /> Send
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-500">AI answers can contain mistakes. Check the original article for important details.</p>
      </div>
    </section>
  );
}
