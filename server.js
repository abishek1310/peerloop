// PeerLoop — peer-review queue + kudos + weekly digest for the Cursor Boston cohort.
// Zero dependencies: node:http static server + JSON-file persistence.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_FILE = path.join(__dirname, "data", "data.json");
const PORT = process.env.PORT || 3000;

// ---------- persistence ----------

const EMPTY_STATE = { submissions: [], reviews: [], kudos: [] };

function loadState() {
  try {
    return { ...EMPTY_STATE, ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

let state = loadState();

function saveState() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// ---------- helpers ----------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 100_000) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const clean = (v, max = 500) => String(v ?? "").trim().slice(0, max);

function requireFields(body, fields) {
  const missing = fields.filter((f) => !clean(body[f]));
  return missing.length ? `Missing: ${missing.join(", ")}` : null;
}

// ---------- API ----------

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/state") {
    return json(res, 200, state);
  }

  if (req.method === "POST" && url.pathname === "/api/submissions") {
    const b = await readBody(req);
    const err = requireFields(b, ["author", "title", "week"]);
    if (err) return json(res, 400, { error: err });
    const sub = {
      id: crypto.randomUUID(),
      author: clean(b.author, 60),
      week: clean(b.week, 20),
      title: clean(b.title, 120),
      blurb: clean(b.blurb, 500),
      liveUrl: clean(b.liveUrl, 300),
      repoUrl: clean(b.repoUrl, 300),
      loomUrl: clean(b.loomUrl, 300),
      createdAt: new Date().toISOString(),
    };
    state.submissions.push(sub);
    saveState();
    return json(res, 201, sub);
  }

  if (req.method === "POST" && url.pathname === "/api/reviews") {
    const b = await readBody(req);
    const err = requireFields(b, ["submissionId", "reviewer", "works", "improve"]);
    if (err) return json(res, 400, { error: err });
    const sub = state.submissions.find((s) => s.id === b.submissionId);
    if (!sub) return json(res, 404, { error: "submission not found" });
    if (sub.author.toLowerCase() === clean(b.reviewer, 60).toLowerCase())
      return json(res, 400, { error: "you can't review your own submission" });
    const review = {
      id: crypto.randomUUID(),
      submissionId: sub.id,
      reviewer: clean(b.reviewer, 60),
      works: clean(b.works, 1000),
      improve: clean(b.improve, 1000),
      createdAt: new Date().toISOString(),
    };
    state.reviews.push(review);
    saveState();
    return json(res, 201, review);
  }

  if (req.method === "POST" && url.pathname === "/api/kudos") {
    const b = await readBody(req);
    const err = requireFields(b, ["from", "to", "note"]);
    if (err) return json(res, 400, { error: err });
    const k = {
      id: crypto.randomUUID(),
      from: clean(b.from, 60),
      to: clean(b.to, 60),
      emoji: clean(b.emoji, 8) || "🎉",
      note: clean(b.note, 300),
      week: clean(b.week, 20),
      createdAt: new Date().toISOString(),
    };
    state.kudos.push(k);
    saveState();
    return json(res, 201, k);
  }

  return json(res, 404, { error: "not found" });
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(req, res, url);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
    return;
  }

  // static files
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(full, (err, buf) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`PeerLoop running on http://localhost:${PORT}`);
});
