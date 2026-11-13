import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogOut, MessageSquare, Search } from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const onSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/news?q=${encodeURIComponent(q)}`);
  };

  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-ink-100 text-ink-900" : "text-ink-700 hover:bg-ink-100"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/chat" className={linkClass}><span className="inline-flex items-center gap-1.5"><MessageSquare size={15} />AI Chat</span></NavLink>
        </nav>
        <form onSubmit={onSearch} role="search" className="order-last w-full md:order-none md:ml-auto md:w-80">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              className="input pl-9"
              type="search"
              placeholder="Search the news…"
              aria-label="Search news"
              maxLength={100}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </form>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <Link to="/chat" className="btn-ghost px-2 md:hidden" aria-label="AI Chat"><MessageSquare size={18} /></Link>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
            <span className="hidden text-sm font-semibold sm:inline">{user?.name}</span>
          </div>
          <button onClick={logout} className="btn-ghost px-2" aria-label="Log out" title="Log out"><LogOut size={18} /></button>
        </div>
      </div>
    </header>
  );
}
