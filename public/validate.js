const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function validateLogin(email, password) {
  const errors = [];
  const emailText = typeof email === "string" ? email.trim() : "";
  const passwordText = typeof password === "string" ? password : "";

  if (!emailText || !passwordText) {
    errors.push("Email and password are required.");
  }
  if (emailText && !emailText.includes("@")) {
    errors.push('Email must contain "@".');
  }
  if (passwordText && passwordText.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }
  if (emailText && CONTROL_CHARS.test(emailText)) {
    errors.push("Email contains invalid characters.");
  }
  if (emailText && emailText.includes("@") && !EMAIL_PATTERN.test(emailText)) {
    errors.push("Enter a valid email address.");
  }
  if (emailText.length > 254) {
    errors.push("Email is too long.");
  }
  if (passwordText.length > 72) {
    errors.push("Password must be at most 72 characters.");
  }

  return errors;
}

export function validateRegistration(email, password, confirm) {
  const errors = validateLogin(email, password);
  if (typeof password !== "string" || password !== confirm) {
    errors.push("Password confirmation does not match.");
  }
  return errors;
}
