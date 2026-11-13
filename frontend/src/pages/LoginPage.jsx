import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import FormField from "../components/FormField";
import ErrorBanner from "../components/ErrorBanner";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/api";
import { validateLogin } from "../utils/validation";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validateLogin(form);
    setErrors(found);
    setApiError("");
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      setApiError(getErrorMessage(err, "Could not log in."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to read summarized news and chat with AI.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <ErrorBanner message={apiError} />
        <FormField id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} />
        <FormField id="password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set("password")} error={errors.password} />
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner size={16} />} Log in
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">
        New here? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
