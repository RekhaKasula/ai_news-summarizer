import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { newsService } from "../services/newsService";
import { getErrorMessage } from "../services/api";
import Spinner from "./Spinner";

/** Shows the AI summary (and key points) or a retry button when the summary is missing. */
export default function SummaryBlock({ article, onUpdate, showPoints = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      onUpdate?.(await newsService.summarize(article.id));
    } catch (err) {
      setError(getErrorMessage(err, "Could not generate the summary."));
    } finally {
      setBusy(false);
    }
  };

  if (!article.summary) {
    return (
      <div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-700">
        <p>{article.description || "No description available."}</p>
        <button className="btn-secondary mt-3 px-3 py-1.5 text-xs" onClick={generate} disabled={busy}>
          {busy ? <Spinner size={14} /> : <Sparkles size={14} />}
          {busy ? "Summarizing…" : "Generate AI summary"}
        </button>
        {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-700">{article.summary}</p>
      {showPoints && article.key_points?.length > 0 && (
        <ul className="mt-4 space-y-2">
          {article.key_points.map((p, i) => (
            <li key={i} className="flex gap-3 text-sm text-ink-900">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-700" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-500">
        {article.content_available ? "AI summary based on the headline, description and article excerpt." : "AI summary based on limited information (headline and short description only)."}
      </p>
      {showPoints && (
        <button className="btn-ghost mt-2 px-2 py-1 text-xs" onClick={generate} disabled={busy}>
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> Regenerate
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
