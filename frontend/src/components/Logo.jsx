import { Newspaper } from "lucide-react";
import { Link } from "react-router-dom";

export default function Logo({ to = "/", light = false }) {
  return (
    <Link to={to} className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
        <Newspaper size={20} />
      </span>
      <span className={`font-serif text-lg font-bold leading-none ${light ? "text-white" : "text-ink-900"}`}>
        AI News <span className="text-brand-700">Summarizer</span>
      </span>
    </Link>
  );
}
