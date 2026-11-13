import { useCallback, useEffect, useRef, useState } from "react";
import { newsService } from "../services/newsService";
import { getErrorMessage } from "../services/api";

/** Loads one page of news for a category/search, supports refresh and "load more". */
export function useNews({ category, q }) {
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [summariesFailed, setSummariesFailed] = useState(0);
  const requestId = useRef(0); // ignore responses from outdated requests

  const load = useCallback(
    async (targetPage, { refresh = false } = {}) => {
      const id = ++requestId.current;
      const append = targetPage > 1;
      append ? setLoadingMore(true) : setLoading(true);
      setError("");
      try {
        const data = await newsService.list({ category, q, page: targetPage, refresh });
        if (id !== requestId.current) return;
        setArticles((prev) => {
          if (!append) return data.articles;
          const known = new Set(prev.map((a) => a.id));
          const fresh = data.articles.filter((a) => !known.has(a.id));
          // If the provider returned nothing new, there is no point offering "Load more" again.
          if (fresh.length === 0) setHasMore(false);
          return [...prev, ...fresh];
        });
        setPage(targetPage);
        if (data.articles.length > 0) setHasMore(data.has_more);
        else setHasMore(false);
        setSummariesFailed(data.summaries_failed || 0);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(getErrorMessage(err, "Could not load the news."));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [category, q]
  );

  useEffect(() => {
    setArticles([]);
    setHasMore(false);
    load(1);
  }, [load]);

  const updateArticle = useCallback((updated) => {
    setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }, []);

  return {
    articles,
    loading,
    loadingMore,
    error,
    hasMore,
    summariesFailed,
    refresh: () => load(1, { refresh: true }),
    retry: () => load(1),
    loadMore: () => load(page + 1),
    updateArticle,
  };
}
