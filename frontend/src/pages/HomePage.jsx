import { useNavigate } from "react-router-dom";
import CategoryGrid from "../components/CategoryGrid";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <section className="mb-10 rounded-2xl bg-ink-900 px-6 py-12 text-white md:px-12">
        <p className="text-sm font-bold uppercase tracking-widest text-brand-100">Hello, {user?.name?.split(" ")[0]}</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight md:text-4xl">
          Understand today’s news without reading the whole article.
        </h1>
        <p className="mt-3 max-w-xl text-ink-300">
          Pick a topic to get AI summaries and key points, then ask follow-up questions about any story.
        </p>
      </section>
      <h2 className="mb-4 text-2xl font-bold">Choose a category</h2>
      <CategoryGrid onSelect={(id) => navigate(`/news?category=${id}`)} />
    </div>
  );
}
