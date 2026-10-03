import { validateLogin } from "./validate.js";

const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const errorsEl = document.querySelector("#errors");
const submittedEl = document.querySelector("#submitted");
const submittedEmailEl = document.querySelector("#submitted-email");
const submitButton = document.querySelector("#login-button");
const togglePassword = document.querySelector("#toggle-password");
const rememberInput = document.querySelector("#remember");
const accountPanel = document.querySelector("#account");
const accountEmail = document.querySelector("#account-email");
const loginCard = document.querySelector("#login-card");
const registeredNote = document.querySelector("#registered-note");

const remembered = localStorage.getItem("rememberedEmail");
if (remembered) {
  emailInput.value = remembered;
  rememberInput.checked = true;
}

const params = new URLSearchParams(window.location.search);
if (params.get("registered") === "1") {
  registeredNote.hidden = false;
}

function showErrors(errors) {
  errorsEl.replaceChildren();
  if (!errors.length) {
    errorsEl.hidden = true;
    return;
  }
  const list = document.createElement("ul");
  for (const message of errors) {
    const item = document.createElement("li");
    item.textContent = message;
    list.append(item);
  }
  errorsEl.append(list);
  errorsEl.hidden = false;
}

function showSubmitted(email) {
  submittedEl.hidden = false;
  submittedEmailEl.textContent = email;
}

togglePassword.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  togglePassword.textContent = showing ? "Show" : "Hide";
  togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
});

async function showAccount() {
  const response = await fetch("/api/me");
  if (!response.ok) return;
  const body = await response.json();
  accountEmail.textContent = body.email;
  loginCard.hidden = true;
  accountPanel.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value;
  const password = passwordInput.value;
  const errors = validateLogin(email, password);
  showSubmitted(email);

  if (errors.length) {
    showErrors(errors);
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Signing in…";
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json();
    if (!response.ok) {
      showErrors(Array.isArray(body.errors) ? body.errors : ["Sign-in failed."]);
      return;
    }
    if (rememberInput.checked) {
      localStorage.setItem("rememberedEmail", email.trim().toLowerCase());
    } else {
      localStorage.removeItem("rememberedEmail");
    }
    showErrors([]);
    registeredNote.hidden = true;
    await showAccount();
  } catch {
    showErrors(["The server could not be reached. Nothing was signed in."]);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Log in";
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  accountPanel.hidden = true;
  loginCard.hidden = false;
  passwordInput.value = "";
  showErrors([]);
  submittedEl.hidden = true;
});

showAccount().catch(() => {
  showErrors(["The server could not be reached."]);
});
