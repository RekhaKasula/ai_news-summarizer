import { CATEGORIES } from "../utils/constants";

export default function CategoryGrid({ onSelect, selected }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {CATEGORIES.map(({ id, label, icon: Icon, blurb }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          aria-pressed={selected === id}
          className={`card group flex flex-col items-start gap-3 p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-md ${selected === id ? "border-brand-600 ring-2 ring-brand-600/20" : ""}`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
            <Icon size={22} />
          </span>
          <span>
            <span className="block font-serif text-lg font-bold">{label}</span>
            <span className="mt-0.5 block text-xs text-ink-500">{blurb}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
