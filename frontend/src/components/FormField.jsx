export default function FormField({ id, label, error, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink-700">{label}</label>
      <input id={id} className={`input ${error ? "border-red-500" : ""}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
