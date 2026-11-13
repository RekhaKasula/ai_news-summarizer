export default function ConfirmDialog({ open, title, message, confirmLabel = "Delete", busy = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="card w-full max-w-sm p-6">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm text-ink-700">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={onConfirm} disabled={busy}>{busy ? "Deleting…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
