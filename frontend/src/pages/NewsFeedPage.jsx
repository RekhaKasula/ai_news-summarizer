import { Newspaper, RefreshCw, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import NewsCard from "../components/NewsCard";
import NewsSkeleton from "../components/NewsSkeleton";
import ErrorBanner from "../components/ErrorBanner";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { useNews } from "../hooks/useNews";
import { useAskAI } from "../hooks/useAskAI";
import { CATEGORIES, categoryLabel } from "../utils/constants";

export default function NewsFeedPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "";
  const q = params.get("q") || "";
  const { articles, loading, loadingMore, error, hasMore, summariesFailed, refresh, retry, loadMore, updateArticle } = useNews({ category, q });
  const { askAI, busyId, error: askError } = useAskAI();

  if (!category && !q) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState icon={Newspaper} title="Pick a category" action={<Link to="/" className="btn-primary">Browse categories</Link>}>
          Choose a category or use the search bar to find stories.
        </EmptyState>
      </div>
    );
  }

  const heading = q ? `Search: “${q}”` : categoryLabel(category);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{heading}</h1>
        <button className="btn-secondary" onClick={refresh} disabled={loading}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh news
        </button>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === category && !q}
            onClick={() => setParams({ category: c.id })}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              c.id === category && !q ? "border-brand-700 bg-brand-700 text-white" : "border-ink-300 bg-white text-ink-700 hover:border-brand-600"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <ErrorBanner message={error} onRetry={retry} />
        <ErrorBanner message={askError} />
        {summariesFailed > 0 && !error && (
          <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {summariesFailed} article{summariesFailed > 1 ? "s" : ""} could not be summarized right now. Use “Generate AI summary” on a card to retry.
          </p>
        )}

        {loading && <NewsSkeleton />}

        {!loading && !error && articles.length === 0 && (
          <EmptyState icon={Search} title="No stories found">
            The news provider returned nothing for this {q ? "search" : "category"} right now. Try refreshing or choose another topic.
          </EmptyState>
        )}

        {!loading && articles.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <NewsCard key={a.id} article={a} onAskAI={askAI} asking={busyId === a.id} onUpdate={updateArticle} />
            ))}
          </div>
        )}

        {!loading && hasMore && (
          <div className="flex justify-center pt-4">
            <button className="btn-secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore && <Spinner size={16} />} Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
