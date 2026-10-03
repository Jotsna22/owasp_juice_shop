import { validateRegistration } from "./validate.js";

const form = document.querySelector("#register-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const confirmInput = document.querySelector("#confirm");
const errorsEl = document.querySelector("#errors");
const submitButton = document.querySelector("#register-button");

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value;
  const password = passwordInput.value;
  const confirm = confirmInput.value;
  const errors = validateRegistration(email, password, confirm);
  if (errors.length) {
    showErrors(errors);
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Creating account…";
  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirm }),
    });
    const body = await response.json();
    if (!response.ok) {
      showErrors(Array.isArray(body.errors) ? body.errors : ["Registration failed."]);
      return;
    }
    window.location.assign("/?registered=1");
  } catch {
    showErrors(["The server could not be reached. No account was created."]);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create account";
  }
});
