// PeerLoop frontend — vanilla JS, no build step.

const WEEKS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"];
const CURRENT_WEEK = "Week 2";

let state = { submissions: [], reviews: [], kudos: [] };
let reviewTarget = null;

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- identity ----------

const nameInput = $("#myName");
nameInput.value = localStorage.getItem("peerloop-name") || "";
nameInput.addEventListener("change", () => localStorage.setItem("peerloop-name", nameInput.value.trim()));

function myName() {
  const n = nameInput.value.trim();
  if (!n) {
    toast("Set your @handle in the top-right first", true);
    nameInput.focus();
  }
  return n;
}

// ---------- tabs ----------

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("#tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ---------- api ----------

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request failed");
  return data;
}

async function refresh() {
  state = await api("/api/state");
  renderQueue();
  renderShips();
  renderKudos();
  renderDigest();
}

// ---------- helpers ----------

const reviewsFor = (id) => state.reviews.filter((r) => r.submissionId === id);
const thisWeek = (arr) => arr.filter((x) => x.week === CURRENT_WEEK);

function linkRow(s) {
  const links = [];
  if (s.liveUrl) links.push(`<a href="${esc(s.liveUrl)}" target="_blank" rel="noopener">🌐 Live</a>`);
  if (s.repoUrl) links.push(`<a href="${esc(s.repoUrl)}" target="_blank" rel="noopener">📦 Repo</a>`);
  if (s.loomUrl) links.push(`<a href="${esc(s.loomUrl)}" target="_blank" rel="noopener">🎥 Loom</a>`);
  return links.length ? `<div class="links">${links.join("")}</div>` : "";
}

// ---------- render: queue ----------

function renderQueue() {
  const subs = thisWeek(state.submissions)
    .map((s) => ({ ...s, reviewCount: reviewsFor(s.id).length }))
    .sort((a, b) => a.reviewCount - b.reviewCount || a.createdAt.localeCompare(b.createdAt));

  $("#queueList").innerHTML = subs.length
    ? subs
        .map(
          (s) => `
      <div class="card">
        <h4>${esc(s.title)}<span class="badge ${s.reviewCount === 0 ? "zero" : ""}">${s.reviewCount} review${s.reviewCount === 1 ? "" : "s"}</span></h4>
        <div class="meta">by ${esc(s.author)} · ${esc(s.week)}</div>
        ${s.blurb ? `<div class="blurb">${esc(s.blurb)}</div>` : ""}
        ${linkRow(s)}
        <button class="ghost" data-review="${s.id}">✍️ Claim a review</button>
      </div>`
        )
        .join("")
    : `<div class="card"><div class="blurb">No ships in the queue for ${esc(CURRENT_WEEK)} yet. Be the first — head to 🚢 This Week's Ships.</div></div>`;

  document.querySelectorAll("[data-review]").forEach((btn) =>
    btn.addEventListener("click", () => openReview(btn.dataset.review))
  );
}

// ---------- render: ships ----------

function renderShips() {
  const subs = thisWeek(state.submissions).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $("#shipsList").innerHTML = subs
    .map((s) => {
      const revs = reviewsFor(s.id);
      return `
      <div class="card">
        <h4>${esc(s.title)}</h4>
        <div class="meta">by ${esc(s.author)} · ${new Date(s.createdAt).toLocaleString()}</div>
        ${s.blurb ? `<div class="blurb">${esc(s.blurb)}</div>` : ""}
        ${linkRow(s)}
        ${revs
          .map(
            (r) => `
          <div class="review">
            <div class="who">review by ${esc(r.reviewer)}</div>
            <p>💪 ${esc(r.works)}</p>
            <p>🔧 ${esc(r.improve)}</p>
          </div>`
          )
          .join("")}
      </div>`;
    })
    .join("");
}

// ---------- render: kudos ----------

function renderKudos() {
  const list = [...state.kudos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  $("#kudosList").innerHTML = list.length
    ? list
        .map(
          (k) => `
      <div class="card">
        <div class="blurb">${esc(k.emoji)} <strong>${esc(k.to)}</strong> — ${esc(k.note)}</div>
        <div class="meta">from ${esc(k.from)}</div>
      </div>`
        )
        .join("")
    : `<div class="card"><div class="blurb">No kudos yet. Someone in this cohort deserves one — you know who.</div></div>`;

  const tally = {};
  state.kudos.forEach((k) => (tally[k.to] = (tally[k.to] || 0) + 1));
  const board = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 10);
  $("#kudosBoard").innerHTML = board
    .map(([who, n]) => `<li><span>${esc(who)}</span><span class="count">${n}</span></li>`)
    .join("");
}

// ---------- render: digest ----------

function buildDigest() {
  const subs = thisWeek(state.submissions);
  const kud = thisWeek(state.kudos).length ? thisWeek(state.kudos) : state.kudos;
  const lines = [`**📰 PeerLoop digest — ${CURRENT_WEEK}**`, ""];

  lines.push(`**🚢 Ships (${subs.length})**`);
  if (subs.length) {
    subs.forEach((s) => {
      const n = reviewsFor(s.id).length;
      lines.push(`• **${s.title}** by ${s.author} — ${n} review${n === 1 ? "" : "s"}${s.liveUrl ? ` · ${s.liveUrl}` : ""}`);
    });
  } else lines.push("• none yet — get shipping");

  const needEyes = subs.filter((s) => reviewsFor(s.id).length === 0);
  if (needEyes.length) {
    lines.push("", "**👀 Needs eyes (0 reviews)**");
    needEyes.forEach((s) => lines.push(`• ${s.title} by ${s.author}`));
  }

  lines.push("", `**🎉 Kudos (${kud.length})**`);
  if (kud.length) kud.slice(-8).forEach((k) => lines.push(`• ${k.emoji} ${k.to} — ${k.note} _(from ${k.from})_`));
  else lines.push("• none yet — go appreciate someone");

  lines.push("", "_Generated by PeerLoop 🔁_");
  return lines.join("\n");
}

function renderDigest() {
  $("#digestPreview").textContent = buildDigest();
}

$("#copyDigest").addEventListener("click", async () => {
  await navigator.clipboard.writeText(buildDigest());
  toast("Digest copied — paste it in Discord");
});

// ---------- forms ----------

const weekSelect = $("#weekSelect");
weekSelect.innerHTML = WEEKS.map((w) => `<option ${w === CURRENT_WEEK ? "selected" : ""}>${w}</option>`).join("");

$("#shipForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const author = myName();
  if (!author) return;
  const f = new FormData(e.target);
  try {
    await api("/api/submissions", {
      author,
      title: f.get("title"),
      week: f.get("week"),
      liveUrl: f.get("liveUrl"),
      repoUrl: f.get("repoUrl"),
      loomUrl: f.get("loomUrl"),
      blurb: f.get("blurb"),
    });
    e.target.reset();
    weekSelect.value = CURRENT_WEEK;
    toast("Shipped! It's in the review queue 🚢");
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

$("#kudosForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const from = myName();
  if (!from) return;
  const f = new FormData(e.target);
  try {
    await api("/api/kudos", {
      from,
      to: f.get("to"),
      note: f.get("note"),
      emoji: f.get("emoji"),
      week: CURRENT_WEEK,
    });
    e.target.reset();
    toast("Kudos sent 🎉");
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- review modal ----------

function openReview(id) {
  if (!myName()) return;
  reviewTarget = id;
  const sub = state.submissions.find((s) => s.id === id);
  $("#modalTitle").textContent = `Review: ${sub.title}`;
  $("#reviewForm").reset();
  $("#modal").classList.remove("hidden");
}

$("#modalCancel").addEventListener("click", () => $("#modal").classList.add("hidden"));

$("#reviewForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const reviewer = myName();
  if (!reviewer) return;
  const f = new FormData(e.target);
  try {
    await api("/api/reviews", {
      submissionId: reviewTarget,
      reviewer,
      works: f.get("works"),
      improve: f.get("improve"),
    });
    $("#modal").classList.add("hidden");
    toast("Review submitted ✍️");
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- toast ----------

let toastTimer;
function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.style.background = isError ? "#e5534b" : "var(--green)";
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

// ---------- go ----------

refresh();
