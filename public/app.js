import { validateLogin } from "./validate.js";

const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const errorsEl = document.querySelector("#errors");
const submitButton = document.querySelector("#login-button");
const togglePassword = document.querySelector("#toggle-password");
const rememberInput = document.querySelector("#remember");
const accountPanel = document.querySelector("#account");
const accountEmail = document.querySelector("#account-email");
const loginCard = document.querySelector("#login-card");
const registeredNote = document.querySelector("#registered-note");
const main = document.querySelector("main");
const menuEl = document.querySelector("#menu");
const menuError = document.querySelector("#menu-error");
const cartLines = document.querySelector("#cart-lines");
const cartEmpty = document.querySelector("#cart-empty");
const cartTotal = document.querySelector("#cart-total");
const orderNote = document.querySelector("#order-note");
const placeOrder = document.querySelector("#place-order");
const cart = new Map();
let menuItems = [];

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

togglePassword.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  togglePassword.textContent = showing ? "Show" : "Hide";
  togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
});

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function showMenuError(message) {
  menuError.replaceChildren();
  if (!message) {
    menuError.hidden = true;
    return;
  }
  menuError.textContent = message;
  menuError.hidden = false;
}

function renderCart() {
  cartLines.replaceChildren();
  let total = 0;
  for (const [id, quantity] of cart) {
    const drink = menuItems.find((item) => item.id === id);
    if (!drink) continue;
    total += drink.cents * quantity;
    const line = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = `${quantity} ${drink.name}`;
    const price = document.createElement("span");
    price.textContent = money(drink.cents * quantity);
    line.append(name, price);
    cartLines.append(line);
  }
  const empty = total === 0;
  cartEmpty.hidden = !empty || !orderNote.hidden;
  cartTotal.hidden = empty;
  cartTotal.textContent = `Total ${money(total)}`;
  placeOrder.disabled = empty;
}

async function loadMenu() {
  if (menuItems.length) return;
  const response = await fetch("/api/menu");
  if (!response.ok) {
    showMenuError("We couldn't load the drinks. Refresh the page and try again.");
    return;
  }
  const body = await response.json();
  menuItems = Array.isArray(body.items) ? body.items : [];
  menuEl.replaceChildren();
  for (const drink of menuItems) {
    const item = document.createElement("li");
    item.className = "drink";
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = drink.name;
    const detail = document.createElement("p");
    detail.className = "fine";
    detail.textContent = drink.detail;
    const price = document.createElement("p");
    price.className = "price";
    price.textContent = money(drink.cents);
    copy.append(title, detail, price);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add";
    add.textContent = "Add";
    add.addEventListener("click", () => {
      const next = (cart.get(drink.id) || 0) + 1;
      if (next > 12) return;
      cart.set(drink.id, next);
      orderNote.hidden = true;
      renderCart();
    });
    item.append(copy, add);
    menuEl.append(item);
  }
  renderCart();
}

async function showAccount() {
  const response = await fetch("/api/me");
  if (!response.ok) return;
  const body = await response.json();
  accountEmail.textContent = body.email;
  loginCard.hidden = true;
  accountPanel.hidden = false;
  main.classList.remove("single");
  main.classList.add("shop-open");
  await loadMenu();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value;
  const password = passwordInput.value;
  const errors = validateLogin(email, password);

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
      showErrors(Array.isArray(body.errors) ? body.errors : ["We couldn't sign you in. Try again."]);
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
    showErrors(["We couldn't sign you in. Check your internet and try again."]);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Log in";
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  accountPanel.hidden = true;
  loginCard.hidden = false;
  main.classList.add("single");
  main.classList.remove("shop-open");
  passwordInput.value = "";
  cart.clear();
  orderNote.hidden = true;
  renderCart();
  showErrors([]);
});

placeOrder.addEventListener("click", async () => {
  placeOrder.disabled = true;
  placeOrder.textContent = "Placing order…";
  orderNote.hidden = true;
  try {
    const items = [...cart.entries()].map(([id, quantity]) => ({ id, quantity }));
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const body = await response.json();
    if (!response.ok) {
      orderNote.textContent = Array.isArray(body.errors) ? body.errors[0] : "We couldn't place that order. Try again.";
      orderNote.hidden = false;
      return;
    }
    const names = body.lines.map((line) => `${line.quantity} ${line.name}`).join(", ");
    orderNote.textContent = `Order placed. ${names}. Total ${money(body.totalCents)}.`;
    orderNote.hidden = false;
    cart.clear();
    renderCart();
  } catch {
    orderNote.textContent = "We couldn't place that order. Check your internet and try again.";
    orderNote.hidden = false;
  } finally {
    placeOrder.textContent = "Place order";
    renderCart();
  }
});

showAccount().catch(() => {
  showErrors(["We couldn't open your account. Refresh the page and try again."]);
});
