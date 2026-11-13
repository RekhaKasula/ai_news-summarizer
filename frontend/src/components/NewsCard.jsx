import { ExternalLink, ImageOff, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate } from "../utils/format";
import { categoryLabel } from "../utils/constants";
import SummaryBlock from "./SummaryBlock";
import Spinner from "./Spinner";

export default function NewsCard({ article, onAskAI, asking, onUpdate }) {
  return (
    <article className="card flex flex-col overflow-hidden transition hover:shadow-md">
      <Link to={`/news/${article.id}`} className="block h-44 overflow-hidden bg-ink-100" aria-label={`Open ${article.title}`} tabIndex={-1}>
        {article.image_url ? (
          <img src={article.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-300 hover:scale-105"
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-300"><ImageOff size={32} /></div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
          <span className="font-bold uppercase tracking-wide text-brand-700">{categoryLabel(article.category)}</span>
          {article.source && <span>· {article.source}</span>}
          {article.published_at && <span>· {formatDate(article.published_at)}</span>}
        </div>
        <h3 className="mb-3 text-lg font-bold leading-snug">
          <Link to={`/news/${article.id}`} className="hover:text-brand-700">{article.title}</Link>
        </h3>
        <div className="flex-1"><SummaryBlock article={article} onUpdate={onUpdate} /></div>
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-ink-100 pt-4">
          <a href={article.original_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-700 hover:text-brand-700">
            Read original <ExternalLink size={14} />
          </a>
          <button className="btn-primary px-3 py-1.5" onClick={() => onAskAI(article.id)} disabled={asking}>
            {asking ? <Spinner size={14} /> : <MessageSquare size={14} />} Ask AI
          </button>
        </div>
      </div>
    </article>
  );
}
