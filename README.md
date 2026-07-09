# PeerLoop 🔁

**Discord is where we talk. PeerLoop is where our weekly ships get reviewed, celebrated, and digested back into Discord.**

Built for the Cursor Boston Summer Cohort (Cohort 2, Week 2 — Communications Build) by [@abishek1310](https://github.com/abishek1310).

**Live:** https://peerloop.onrender.com

## The wedge

Discord already covers chat, voice, and presence for the cohort. What it *doesn't* deliver for a 100-person cohort that ships weekly:

1. **A peer-review queue.** Every week ~dozens of submissions go up, but only the loud ones get feedback. PeerLoop sorts the queue by *fewest reviews first*, so every ship gets eyes before the Friday voting call. Reviews are structured (💪 what works / 🔧 what to improve) — not "nice!" reactions.
2. **Kudos that persist.** Discord thank-yous scroll away in minutes. PeerLoop keeps them, tallies a leaderboard, and feeds them into the digest.
3. **A weekly digest that closes the loop.** One click generates a Markdown digest — ships, review coverage, submissions that still need eyes, kudos — ready to paste straight into the Discord announcements channel. PeerLoop doesn't compete with Discord; it feeds it.

## Run it

Zero dependencies. No build step. No database to provision.

```bash
node server.js
# → http://localhost:3000
```

Requires Node 18+. Data persists to `data/data.json`.

## Deploy (Render, ~3 min)

1. Push this repo to GitHub.
2. [render.com](https://render.com) → New → Web Service → connect the repo.
3. It reads `render.yaml` automatically (free plan, `node server.js`). Done.

> Note: the free tier has an ephemeral disk, so data resets on redeploys — fine for a cohort week. For durability, attach a persistent disk or point `DATA_FILE` at one.

## Architecture

- `server.js` — single-file Node server (`node:http`): static file serving + JSON REST API + atomic JSON-file persistence. **Zero npm dependencies.**
- `public/` — vanilla HTML/CSS/JS frontend. No framework, no bundler.
- Identity is a self-declared @handle (stored in localStorage). Deliberate tradeoff: a 100-person cohort with a shared Discord doesn't need OAuth for week 2 — it needs zero friction.

## API

| Method | Path | Body |
|--------|------|------|
| GET | `/api/state` | — |
| POST | `/api/submissions` | `author, week, title, blurb?, liveUrl?, repoUrl?, loomUrl?` |
| POST | `/api/reviews` | `submissionId, reviewer, works, improve` (self-reviews rejected) |
| POST | `/api/kudos` | `from, to, note, emoji?, week?` |
