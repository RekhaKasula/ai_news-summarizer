import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import FormField from "../components/FormField";
import ErrorBanner from "../components/ErrorBanner";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/api";
import { validateRegister } from "../utils/validation";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validateRegister(form);
    setErrors(found);
    setApiError("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setApiError(getErrorMessage(err, "Could not create the account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Get AI summaries of the news you care about.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <ErrorBanner message={apiError} />
        <FormField id="name" label="Name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
        <FormField id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} />
        <FormField id="password" label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} />
        <FormField id="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} />
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner size={16} />} Register
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">
        Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link>
      </p>
    </AuthLayout>
  );
}
