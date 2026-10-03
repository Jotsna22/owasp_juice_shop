import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import express from "express";
import { DatabaseSync } from "node:sqlite";
import { validateLogin, validateRegistration } from "./public/validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BCRYPT_COST = 10;
const DEMO_EMAIL = "demo@juice.lab";
const DEMO_PASSWORD = "Lemonade1";
const SESSION_TTL_MS = 60 * 60 * 1000;
const MENU = [
  { id: "orange", name: "Orange juice", detail: "Fresh squeezed oranges", cents: 450 },
  { id: "apple", name: "Apple juice", detail: "Cold pressed apples", cents: 400 },
  { id: "lemonade", name: "Lemonade", detail: "Lemon, water, and a little sugar", cents: 350 },
  { id: "green", name: "Green juice", detail: "Apple, cucumber, and kale", cents: 550 },
  { id: "berry", name: "Berry blend", detail: "Strawberry, blueberry, and apple", cents: 500 },
];

export function createApp({ dbPath = ":memory:", rateLimitPerMinute = 8 } = {}) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const findUser = db.prepare(
    "SELECT email, password_hash FROM users WHERE email = ?",
  );
  const findId = db.prepare("SELECT id FROM users WHERE email = ?");
  const insertUser = db.prepare(
    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
  );

  if (!findId.get(DEMO_EMAIL)) {
    insertUser.run(DEMO_EMAIL, bcrypt.hashSync(DEMO_PASSWORD, BCRYPT_COST));
  }

  const dummyHash = bcrypt.hashSync("dummy-password-not-used", BCRYPT_COST);
  const sessions = new Map();
  const attempts = new Map();

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  app.use(express.static(path.join(__dirname, "public")));

  function tooManyAttempts(ip) {
    const now = Date.now();
    const current = attempts.get(ip);
    if (!current || now > current.reset) {
      attempts.set(ip, { count: 1, reset: now + 60_000 });
      return false;
    }
    current.count += 1;
    return current.count > rateLimitPerMinute;
  }

  function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      return new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  }

  function readCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(";")) {
      const [key, ...rest] = part.trim().split("=");
      if (key === name) return decodeURIComponent(rest.join("="));
    }
    return null;
  }

  app.post("/api/login", (req, res) => {
    if (!sameOrigin(req)) {
      return res.status(403).json({ ok: false, errors: ["Please sign in from this page."] });
    }
    if (tooManyAttempts(req.socket.remoteAddress || "unknown")) {
      return res.status(429).json({
        ok: false,
        errors: ["Too many tries. Wait a minute, then try again."],
      });
    }

    const email = req.body?.email;
    const password = req.body?.password;
    const errors = validateLogin(email, password);
    if (errors.length) {
      return res.status(400).json({ ok: false, errors });
    }

    const normalized = email.trim().toLowerCase();
    const user = findUser.get(normalized);
    const hash = user?.password_hash ?? dummyHash;
    const match = bcrypt.compareSync(password, hash);
    if (!user || !match) {
      return res.status(401).json({ ok: false, errors: ["That email or password doesn't match our records."] });
    }

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { email: user.email, created: Date.now() });
    res.setHeader(
      "Set-Cookie",
      `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`,
    );
    return res.json({ ok: true, email: user.email });
  });

  app.post("/api/register", (req, res) => {
    if (!sameOrigin(req)) {
      return res.status(403).json({ ok: false, errors: ["Please create your account from this page."] });
    }
    if (tooManyAttempts(req.socket.remoteAddress || "unknown")) {
      return res.status(429).json({
        ok: false,
        errors: ["Too many tries. Wait a minute, then try again."],
      });
    }

    const email = req.body?.email;
    const password = req.body?.password;
    const confirm = req.body?.confirm;
    const errors = validateRegistration(email, password, confirm);
    if (errors.length) {
      return res.status(400).json({ ok: false, errors });
    }

    const normalized = email.trim().toLowerCase();
    if (findId.get(normalized)) {
      return res.status(409).json({
        ok: false,
        errors: ["An account with that email already exists. Try signing in."],
      });
    }

    insertUser.run(normalized, bcrypt.hashSync(password, BCRYPT_COST));
    return res.status(201).json({ ok: true });
  });

  function currentSession(req) {
    const token = readCookie(req, "session");
    const session = token ? sessions.get(token) : null;
    if (!session || Date.now() - session.created > SESSION_TTL_MS) {
      if (token) sessions.delete(token);
      return null;
    }
    return session;
  }

  app.get("/api/menu", (_req, res) => {
    return res.json({ ok: true, items: MENU });
  });

  app.get("/api/me", (req, res) => {
    const session = currentSession(req);
    if (!session) return res.status(401).json({ ok: false });
    return res.json({ ok: true, email: session.email });
  });

  app.post("/api/orders", (req, res) => {
    if (!sameOrigin(req)) {
      return res.status(403).json({ ok: false, errors: ["Please order from this page."] });
    }
    const session = currentSession(req);
    if (!session) {
      return res.status(401).json({ ok: false, errors: ["Sign in before you order."] });
    }

    const requested = req.body?.items;
    if (!Array.isArray(requested) || requested.length === 0) {
      return res.status(400).json({ ok: false, errors: ["Add a drink before you place the order."] });
    }
    if (requested.length > MENU.length) {
      return res.status(400).json({ ok: false, errors: ["That order is too long."] });
    }

    const lines = [];
    const seen = new Set();
    for (const item of requested) {
      const drink = MENU.find((entry) => entry.id === item?.id);
      const quantity = item?.quantity;
      if (!drink || seen.has(drink.id)) {
        return res.status(400).json({ ok: false, errors: ["Pick a drink from the list."] });
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 12) {
        return res.status(400).json({ ok: false, errors: ["Choose between 1 and 12 of each drink."] });
      }
      seen.add(drink.id);
      lines.push({
        name: drink.name,
        quantity,
        cents: drink.cents * quantity,
      });
    }

    const totalCents = lines.reduce((sum, line) => sum + line.cents, 0);
    return res.status(201).json({ ok: true, email: session.email, lines, totalCents });
  });

  app.post("/api/logout", (req, res) => {
    const token = readCookie(req, "session");
    if (token) sessions.delete(token);
    res.setHeader("Set-Cookie", "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
    return res.json({ ok: true });
  });

  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ ok: false, errors: ["Something was wrong with that. Please try again."] });
    }
    return res.status(500).json({ ok: false, errors: ["Something went wrong. Please try again."] });
  });

  app.locals.db = db;
  return app;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const dataDir = path.join(__dirname, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const app = createApp({ dbPath: path.join(dataDir, "users.db") });
  const port = Number(process.env.PORT) || 47291;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Juice Shop login lab listening on http://127.0.0.1:${port}`);
  });
}
