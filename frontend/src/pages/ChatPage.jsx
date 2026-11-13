import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Menu } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import { chatService } from "../services/chatService";
import { getErrorMessage } from "../services/api";

export default function ChatPage() {
  const { sessionId } = useParams();
  const activeId = sessionId ? Number(sessionId) : null;
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    chatService
      .listSessions()
      .then((data) => !cancelled && setSessions(data))
      .catch((err) => !cancelled && setError(getErrorMessage(err, "Could not load your conversations.")))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [activeId]); // reload when a new conversation is opened (e.g. created from "Ask AI")

  const onSessionUpdated = useCallback((updated) => {
    setSessions((prev) => [updated, ...prev.filter((s) => s.id !== updated.id)]);
  }, []);

  const newConversation = async () => {
    setCreating(true);
    setError("");
    try {
      const session = await chatService.createSession();
      setSessions((prev) => [session, ...prev]);
      setSidebarOpen(false);
      navigate(`/chat/${session.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not create a conversation."));
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await chatService.deleteSession(toDelete.id);
      setSessions((prev) => prev.filter((s) => s.id !== toDelete.id));
      if (toDelete.id === activeId) navigate("/chat");
      setToDelete(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete the conversation."));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative mx-auto flex h-[calc(100vh-120px)] min-h-[480px] max-w-7xl overflow-hidden border-x border-ink-200 bg-white md:h-[calc(100vh-65px)]">
      <div className={`absolute inset-y-0 left-0 z-30 w-72 transition-transform md:static md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <ChatSidebar sessions={sessions} loading={loading} error={error} activeId={activeId} onNew={newConversation} creating={creating} onDelete={setToDelete} />
      </div>
      {sidebarOpen && <button className="absolute inset-0 z-20 bg-ink-900/30 md:hidden" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <button className="btn-ghost justify-start rounded-none border-b border-ink-200 md:hidden" onClick={() => setSidebarOpen(true)}>
          <Menu size={18} /> Conversations
        </button>
        {activeId ? (
          <ChatWindow key={activeId} sessionId={activeId} onSessionUpdated={onSessionUpdated} />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-ink-50 p-6">
            <EmptyState icon={MessageSquare} title="Select or start a conversation">
              Open a previous conversation from the sidebar, start a new one, or press “Ask AI” on any news article.
            </EmptyState>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete conversation?"
        message={`“${toDelete?.title ?? ""}” and all its messages will be permanently deleted.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
