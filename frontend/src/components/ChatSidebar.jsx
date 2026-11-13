import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate } from "../utils/format";
import Spinner from "./Spinner";

export default function ChatSidebar({ sessions, loading, error, activeId, onNew, creating, onDelete }) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-ink-200 bg-white">
      <div className="border-b border-ink-200 p-3">
        <button className="btn-primary w-full" onClick={onNew} disabled={creating}>
          {creating ? <Spinner size={16} /> : <Plus size={16} />} New conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2" aria-label="Previous conversations">
        {loading && <div className="flex justify-center p-6 text-ink-500"><Spinner /></div>}
        {error && <p role="alert" className="p-3 text-sm text-red-700">{error}</p>}
        {!loading && !error && sessions.length === 0 && (
          <p className="p-4 text-center text-sm text-ink-500">No conversations yet. Start one with “Ask AI” on any article.</p>
        )}
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li key={s.id} className="group relative">
              <Link
                to={`/chat/${s.id}`}
                className={`flex items-start gap-2 rounded-lg p-3 pr-10 ${s.id === activeId ? "bg-brand-50" : "hover:bg-ink-100"}`}
              >
                <MessageSquare size={16} className="mt-0.5 shrink-0 text-ink-500" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{s.title}</span>
                  <span className="block text-xs text-ink-500">{formatDate(s.updated_at)}</span>
                </span>
              </Link>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-500 opacity-60 hover:bg-red-50 hover:text-red-700 group-hover:opacity-100 focus:opacity-100"
                aria-label={`Delete conversation ${s.title}`}
                onClick={() => onDelete(s)}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
