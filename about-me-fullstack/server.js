const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? null : "dev-secret-change-me");
if (!SECRET) { console.error("JWT_SECRET muhit oʻzgaruvchisi kerak."); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL muhit oʻzgaruvchisi kerak."); process.exit(1); }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});
pool.on("error", (e) => console.error("DB xatosi:", e.message));

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      pass TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      loc TEXT NOT NULL DEFAULT '',
      photo TEXT NOT NULL DEFAULT '',
      results JSONB NOT NULL DEFAULT '{}'::jsonb,
      iq INT,
      eq INT,
      created TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_name_lower ON users(lower(name));
    CREATE INDEX IF NOT EXISTS users_iq ON users(iq DESC);
    CREATE INDEX IF NOT EXISTS users_eq ON users(eq DESC);
  `);
}

const NB = { 1: [9, 2], 2: [1, 3], 3: [2, 4], 4: [3, 5], 5: [4, 6], 6: [5, 7], 7: [6, 8], 8: [7, 9], 9: [8, 1] };
const int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Mijozdan kelgan natijalarni tekshirib, faqat toʻgʻri shakldagilarini qoldiradi
function clean(r) {
  const o = {};
  if (!r || typeof r !== "object") return o;
  const at = str(r.at, 20);
  const m = r.mbti;
  if (m && /^[EI][SN][TF][JP]$/.test(m.type) && ["A", "T"].includes(m.id) && Array.isArray(m.pct) && m.pct.length === 5 && m.pct.every((x) => int(x, 0, 100)))
    o.mbti = { type: m.type, id: m.id, pct: m.pct, at };
  const i = r.iq;
  if (i && int(i.score, 70, 148) && int(i.ok, 0, 40)) o.iq = { score: i.score, ok: i.ok, sec: int(i.sec, 0, 86400) ? i.sec : 0, at };
  const e = r.eq;
  if (e && int(e.score, 0, 100)) o.eq = { score: e.score, at, d: Array.isArray(e.d) && e.d.length === 4 && e.d.every((x) => int(x, 0, 100)) ? e.d : undefined };
  const n = r.enn;
  if (n && int(n.type, 1, 9) && NB[n.type].includes(n.wing) && Array.isArray(n.sc) && n.sc.length === 9 && n.sc.every((x) => int(x, 0, 15)))
    o.enn = { type: n.type, wing: n.wing, sc: n.sc, at };
  return o;
}

const out = (u) => ({ name: u.name, bio: u.bio, loc: u.loc, photo: u.photo, results: u.results || {} });
const sign = (u) => jwt.sign({ id: u.id }, SECRET, { expiresIn: "60d" });
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch((e) => { console.error(e); res.status(500).json({ error: "Server xatosi. Birozdan keyin qayta urinib koʻring." }); });

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "300kb" }));

const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Juda koʻp urinish. Birozdan keyin qayta urinib koʻring." } });

const auth = wrap(async (req, res, next) => {
  try {
    const p = jwt.verify((req.headers.authorization || "").replace(/^Bearer /, ""), SECRET);
    const r = await pool.query("SELECT * FROM users WHERE id = $1", [p.id]);
    if (!r.rows[0]) throw new Error("no user");
    req.user = r.rows[0];
    next();
  } catch (e) {
    if (e.code) throw e; // DB xatosi
    res.status(401).json({ error: "Qayta kiring." });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/register", authLimit, wrap(async (req, res) => {
  const name = str(req.body.name, 20), pass = typeof req.body.password === "string" ? req.body.password : "";
  if (!/^[\p{L}\p{N}_. -]{3,20}$/u.test(name)) return res.status(400).json({ error: "Nom 3–20 belgi: harf, raqam, _ . - boʻlishi mumkin." });
  if (pass.length < 4 || pass.length > 72) return res.status(400).json({ error: "Parol 4–72 belgidan iborat boʻlsin." });
  try {
    const r = await pool.query("INSERT INTO users(name, pass) VALUES ($1, $2) RETURNING *", [name, await bcrypt.hash(pass, 10)]);
    res.json({ token: sign(r.rows[0]), user: out(r.rows[0]) });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Bu nom band. Boshqa nom tanlang." });
    throw e;
  }
}));

app.post("/api/login", authLimit, wrap(async (req, res) => {
  const r = await pool.query("SELECT * FROM users WHERE lower(name) = lower($1)", [str(req.body.name, 20)]);
  const u = r.rows[0], pass = typeof req.body.password === "string" ? req.body.password : "";
  if (!u || !(await bcrypt.compare(pass, u.pass))) return res.status(401).json({ error: "Nom yoki parol notoʻgʻri." });
  res.json({ token: sign(u), user: out(u) });
}));

app.get("/api/me", auth, (req, res) => res.json(out(req.user)));

app.put("/api/me", auth, wrap(async (req, res) => {
  const u = req.user, b = req.body || {};
  const photo = typeof b.photo === "string" && (b.photo === "" || (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.photo) && b.photo.length <= 150000)) ? b.photo : u.photo;
  const old = u.results || {}, neu = clean(b.results), merged = Object.assign({}, old, neu);
  for (const k of ["iq", "eq"]) if (old[k] && neu[k] && old[k].score > neu[k].score) merged[k] = old[k]; // eng yaxshi natija saqlanadi
  const r = await pool.query(
    "UPDATE users SET bio=$1, loc=$2, photo=$3, results=$4::jsonb, iq=$5, eq=$6 WHERE id=$7 RETURNING *",
    [str(b.bio, 50), str(b.loc, 30), photo, JSON.stringify(merged), merged.iq ? merged.iq.score : null, merged.eq ? merged.eq.score : null, u.id]
  );
  res.json(out(r.rows[0]));
}));

app.get("/api/leaderboard", wrap(async (req, res) => {
  const col = req.query.type === "eq" ? "eq" : "iq"; // faqat ruxsat etilgan ustun nomlari
  const r = await pool.query(`SELECT name, ${col} AS score FROM users ORDER BY ${col} DESC NULLS LAST, created ASC LIMIT 50`);
  res.json(r.rows);
}));

app.get("/api/user/:name", wrap(async (req, res) => {
  const r = await pool.query("SELECT * FROM users WHERE lower(name) = lower($1)", [str(req.params.name, 20)]);
  if (!r.rows[0]) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
  res.json(out(r.rows[0]));
}));

app.use(express.static(path.join(__dirname, "public")));
app.use("/api", (req, res) => res.status(404).json({ error: "Topilmadi" }));

init()
  .then(() => app.listen(PORT, () => console.log("About me server ishga tushdi, port " + PORT)))
  .catch((e) => { console.error("Bazaga ulanib boʻlmadi:", e.message); process.exit(1); });
