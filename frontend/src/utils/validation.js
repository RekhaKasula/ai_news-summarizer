const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  return errors;
}

export function validateRegister({ name, email, password, confirmPassword }) {
  const errors = validateLogin({ email, password });
  if (!name.trim()) errors.name = "Name is required.";
  if (password && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) {
    errors.password = "Use at least 8 characters with a letter and a number.";
  }
  if (confirmPassword !== password) errors.confirmPassword = "Passwords do not match.";
  return errors;
}
