export default function NewsSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading news">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card animate-pulse overflow-hidden">
          <div className="h-44 bg-ink-200" />
          <div className="space-y-3 p-5">
            <div className="h-3 w-1/3 rounded bg-ink-200" />
            <div className="h-5 w-full rounded bg-ink-200" />
            <div className="h-5 w-4/5 rounded bg-ink-200" />
            <div className="h-3 w-full rounded bg-ink-100" />
            <div className="h-3 w-full rounded bg-ink-100" />
            <div className="h-3 w-2/3 rounded bg-ink-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
