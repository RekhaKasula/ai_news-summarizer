import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { chatService } from "../services/chatService";
import { getErrorMessage } from "../services/api";

/** "Ask AI" on an article: create a conversation tied to it, then open the chat page. */
export function useAskAI() {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const askAI = useCallback(
    async (articleId) => {
      setBusyId(articleId);
      setError("");
      try {
        const session = await chatService.createSession({ articleId });
        navigate(`/chat/${session.id}`);
      } catch (err) {
        setError(getErrorMessage(err, "Could not start a conversation."));
      } finally {
        setBusyId(null);
      }
    },
    [navigate]
  );

  return { askAI, busyId, error };
}
