export default function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {Icon && <Icon size={36} className="mb-3 text-ink-300" />}
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-ink-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
