import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import bcrypt from "bcryptjs";
import { createApp } from "../server.js";

async function start(options = {}) {
  const app = createApp({ rateLimitPerMinute: 100, ...options });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return {
    app,
    server,
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

async function post(base, path, body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { status: response.status, payload, headers: response.headers };
}

test("client and server reject an empty login", async () => {
  const app = await start();
  try {
    const { status, payload } = await post(app.base, "/api/login", { email: "  ", password: "" });
    assert.equal(status, 400);
    assert.match(payload.errors.join(" "), /required/i);
  } finally {
    await app.close();
  }
});

test("password shorter than 8 characters is rejected", async () => {
  const app = await start();
  try {
    const { status, payload } = await post(app.base, "/api/login", {
      email: "demo@juice.lab",
      password: "short",
    });
    assert.equal(status, 400);
    assert.match(payload.errors.join(" "), /at least 8/);
  } finally {
    await app.close();
  }
});

test("email without @ is rejected", async () => {
  const app = await start();
  try {
    const { status, payload } = await post(app.base, "/api/login", {
      email: "not-an-email",
      password: "Lemonade1",
    });
    assert.equal(status, 400);
    assert.match(payload.errors.join(" "), /@/);
  } finally {
    await app.close();
  }
});

test("a classic SQL login string is rejected as an email before any query match", async () => {
  const app = await start();
  try {
    const { status, payload } = await post(app.base, "/api/login", {
      email: "' OR 1=1--",
      password: "password1",
    });
    assert.equal(status, 400);
    assert.match(payload.errors.join(" "), /@/);
  } finally {
    await app.close();
  }
});

test("a SQL-shaped email that passes the format check still cannot bypass authentication", async () => {
  const app = await start();
  try {
    const { status, payload } = await post(app.base, "/api/login", {
      email: "demo@juice.lab'OR'1'='1",
      password: "password1",
    });
    assert.equal(status, 401);
    assert.deepEqual(payload.errors, ["That email or password doesn't match our records."]);
  } finally {
    await app.close();
  }
});

test("a SQL-shaped password does not bypass authentication", async () => {
  const app = await start();
  try {
    const { status } = await post(app.base, "/api/login", {
      email: "demo@juice.lab",
      password: "' OR '1'='1' --",
    });
    assert.equal(status, 401);
  } finally {
    await app.close();
  }
});

test("login stores a bcrypt hash and sets an HttpOnly session", async () => {
  const dbPath = ":memory:";
  const app = await start({ dbPath });
  try {
    const result = await post(app.base, "/api/login", {
      email: "demo@juice.lab",
      password: "Lemonade1",
    });
    assert.equal(result.status, 200);
    assert.equal(result.payload.email, "demo@juice.lab");
    const cookie = result.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.doesNotMatch(cookie, /Lemonade1/);

    const me = await fetch(`${app.base}/api/me`, { headers: { cookie: cookie.split(";")[0] } });
    assert.equal(me.status, 200);
    const body = await me.json();
    assert.equal(body.email, "demo@juice.lab");
  } finally {
    await app.close();
  }
});

test("registration stores bcrypt output rather than the password", async () => {
  const app = await start();
  try {
    const created = await post(app.base, "/api/register", {
      email: "new.customer@juice.lab",
      password: "Orchard99",
      confirm: "Orchard99",
    });
    assert.equal(created.status, 201);

    const row = app.app.locals.db
      .prepare("SELECT password_hash FROM users WHERE email = ?")
      .get("new.customer@juice.lab");
    assert.equal(typeof row.password_hash, "string");
    assert.notEqual(row.password_hash, "Orchard99");
    assert.equal(bcrypt.compareSync("Orchard99", row.password_hash), true);
    assert.match(row.password_hash, /^\$2[aby]\$/);

    const login = await post(app.base, "/api/login", {
      email: "new.customer@juice.lab",
      password: "Orchard99",
    });
    assert.equal(login.status, 200);
  } finally {
    await app.close();
  }
});

test("a markup-shaped email is not reflected by the login API", async () => {
  const app = await start();
  try {
    const hostile = "\"><svg/onload=alert(1)>@x.co";
    const { status, payload } = await post(app.base, "/api/login", {
      email: hostile,
      password: "Lemonade1",
    });
    assert.equal(status, 401);
    assert.equal(JSON.stringify(payload).includes("<svg"), false);
    assert.equal(JSON.stringify(payload).includes("onload"), false);
  } finally {
    await app.close();
  }
});

test("a signed-in customer can place an order", async () => {
  const app = await start();
  try {
    const login = await post(app.base, "/api/login", {
      email: "demo@juice.lab",
      password: "Lemonade1",
    });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const menu = await fetch(`${app.base}/api/menu`);
    const drinks = await menu.json();
    assert.equal(drinks.items.some((item) => item.name === "Orange juice"), true);

    const blocked = await post(app.base, "/api/orders", { items: [{ id: "orange", quantity: 1 }] });
    assert.equal(blocked.status, 401);

    const order = await fetch(`${app.base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ items: [{ id: "orange", quantity: 2 }] }),
    });
    const body = await order.json();
    assert.equal(order.status, 201);
    assert.equal(body.totalCents, 900);
    assert.equal(body.lines[0].name, "Orange juice");
  } finally {
    await app.close();
  }
});

test("login page does not build HTML from user input", async () => {
  const app = await start();
  try {
    const response = await fetch(`${app.base}/`);
    const html = await response.text();
    assert.equal(response.headers.get("content-security-policy")?.includes("script-src 'self'"), true);
    assert.equal(html.includes("innerHTML"), false);
    assert.equal(html.includes("eval("), false);
  } finally {
    await app.close();
  }
});
