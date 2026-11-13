import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, MessageSquare } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { newsService } from "../services/newsService";
import { getErrorMessage } from "../services/api";
import { useAskAI } from "../hooks/useAskAI";
import { categoryLabel } from "../utils/constants";
import { formatDate } from "../utils/format";
import ErrorBanner from "../components/ErrorBanner";
import Spinner from "../components/Spinner";
import SummaryBlock from "../components/SummaryBlock";

export default function NewsDetailPage() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { askAI, busyId, error: askError } = useAskAI();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setArticle(await newsService.get(id));
    } catch (err) {
      setError(getErrorMessage(err, "Could not load this article."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center p-20 text-ink-500"><Spinner size={32} /></div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to={article ? `/news?category=${article.category}` : "/"} className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-ink-700 hover:text-brand-700">
        <ArrowLeft size={16} /> Back to news
      </Link>
      <div className="space-y-4">
        <ErrorBanner message={error} onRetry={load} />
        <ErrorBanner message={askError} />
      </div>
      {article && (
        <article className="card overflow-hidden">
          {article.image_url && (
            <img src={article.image_url} alt="" referrerPolicy="no-referrer" className="max-h-96 w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          <div className="p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{categoryLabel(article.category)}</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight">{article.title}</h1>
            <p className="mt-3 text-sm text-ink-500">
              {[article.source, formatDate(article.published_at)].filter(Boolean).join(" · ")}
            </p>

            <h2 className="mb-2 mt-8 text-xl font-bold">AI summary</h2>
            <SummaryBlock article={article} onUpdate={setArticle} showPoints />

            <div className="mt-8 flex flex-wrap gap-3 border-t border-ink-100 pt-6">
              <button className="btn-primary" onClick={() => askAI(article.id)} disabled={busyId === article.id}>
                {busyId === article.id ? <Spinner size={16} /> : <MessageSquare size={16} />} Ask AI about this article
              </button>
              <a href={article.original_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                Read original article <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
