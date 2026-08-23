# Wagon West — Deployment Handoff (FINAL / v1.0 freeze)

## What this is
A complete, playtested, simulation-balanced browser game: frontier survival in the
Oregon Trail tradition, entirely original IP (original name, landmarks, events,
art, synthesized audio — no trademarked names or copied assets anywhere; keep it
that way). One React component: `WagonWest.jsx` (~1,400 lines). Client-side only.
No backend, no database, no auth. `tools/sim.py` is the Monte Carlo balance
simulator that produced the current tuning — it ships with the repo.

## Stack (note: NO Tailwind)
- Vite + React 18
- lucide-react (icons)
- **All styling is real CSS inside the component's `<style>` block.** Earlier
  drafts used Tailwind; that's gone. Do not add Tailwind. Do not "migrate" the
  CSS to a framework. It renders identically everywhere as-is.
- Deploy target: Vercel free tier, static build.

## Tasks, in order

### 1. Scaffold
- `npm create vite@latest wagon-west -- --template react`
- `npm i lucide-react`
- `WagonWest.jsx` → `src/`, rendered as the entire app from `App.jsx`
- Strip Vite boilerplate CSS (index.css margins/max-width) — the component owns
  the full viewport (`100dvh`, no page scroll, by design)

### 2. REQUIRED code change: storage adapter
The component calls `window.storage.get / .set / .delete` — an API that only
exists inside Claude artifacts. Add near the top of the file:

```js
const storageAdapter = {
  async get(key) {
    const v = localStorage.getItem(key);
    return v != null ? { value: v } : null;
  },
  async set(key, value) { localStorage.setItem(key, value); },
  async delete(key) { localStorage.removeItem(key); },
};
```

Replace every `window.storage.` call with `storageAdapter.` (save-check effect,
auto-save effect, `clearSave`, `resumeGame`). Keep all try/catch as-is.

### 3. NEW feature: shareable save links (URL hash)
Alongside localStorage saves (not replacing them):
- "Copy save link" control on the travel screen near the sound/reset buttons.
  On tap: take the same JSON payload the auto-save builds,
  `btoa(encodeURIComponent(json))`, put it in `location.hash` as `save=...`,
  copy the full URL to clipboard with a brief "copied" state.
- On load: if the hash contains `save=`, decode, hydrate exactly as
  `resumeGame` does, go to travel, clear the hash. Hash beats localStorage.
- Malformed hash: ignore silently.

### 4. Launch polish
- `<title>Wagon West</title>`; meta description: "2,300 miles of open country.
  Not everyone makes it."
- OG tags; generate a simple 1200x630 og-image locally (cream background,
  forest-green serif title) if quick, else skip
- Favicon: simple wagon-wheel or compass mark, generated locally
- `npm run build` must pass; verify preview

### 5. Repo + deploy (pause for auth at both marked steps)
- `git init`, `.gitignore`, initial commit. Include `tools/sim.py` and this file.
- **[ASK USER]** `gh repo create wagon-west --public --source=. --push`
  (or guide through GitHub auth if `gh` isn't logged in)
- **[ASK USER]** `npx vercel --prod` (first run links the Vercel account)
- Report back: repo URL + live URL

## Balance spec — DO NOT retune casually
Current numbers were derived from ~60,000 Monte Carlo runs. Verified state
(optimal-bot win rates; skilled humans land ~10-15 pts lower):

| Start | Perk | Win% | Character |
|---|---|---|---|
| Store Clerk $900 | 10% off all stores | 67% | Buy your way through |
| Carpenter $650 | 40% free breakdown mends | 47% | Self-sufficient |
| Farmer $500 | Oxen at half price | 48% | Pan-or-perish |

Key constants (all in the component): trail 2,300 mi; hunt yield `7+0.5·acc`;
lame-ox event weights 0.75/1.5/2.25 by pace; winter ox loss 1.2%/day; plague
0.8%/day past mile 500 (tonic-gated); food cap 800; spare cap 3. **Any balance
change must be validated by editing the matching constant in `tools/sim.py`
(`KN` dict + constants at top) and re-running `python3 tools/sim.py` before
shipping.** Lame-ox weight is the most sensitive dial in the game (±40% swings
win rates ~30 points).

## Design conventions (apply to ALL future work)
1. **Choice lists order easiest/safest first.** Difficulty implied by copy,
   never labeled. (Trades by money desc; ferry above ford; Early April first.)
2. **No page scroll, ever.** The app is a fixed 100dvh frame. Any overlay with
   more than ~4 interactive elements becomes a full-screen page (store, journal
   pattern), never a squeezed panel. Internal scroll allowed only inside
   dedicated pages.
3. **Selection language:** selected = dark forest fill + green chip
   ("Chosen"/"In Party") + shadow lift. Every tap either changes state or
   audibly refuses (thud) — no silent no-ops.
4. **Color semantics:** forest green = identity/selection/good; rust `#a8462f`
   = danger ONLY (bad events, dying bars, destructive confirms); gold = money;
   slate blue = water/winter. Never use rust decoratively.
5. **The trail teaches.** New mechanics are introduced by geography and journal
   copy, not tutorials (Tinpan Creek → panning; Cotton Ridge → tonic; mile 500
   → plague).
6. **Nothing is fully insurable.** Every resource must have at least one loss
   vector. Preparation shifts odds; it never buys certainty.

## v1.1 roadmap (post-launch, in priority order)
1. **Share/result card** — canvas-rendered run summary (party alive/dead, days,
   cause, rank title) sized for social. The distribution engine.
2. **The Fork** — at Devil's Backbone choose Mountain Cutoff (~-250 mi, no
   further posts, harsher events/health, Broadback crossed at a deeper narrows)
   vs the Long Road (current route). Requires: route state, per-route landmark
   tails + map path, dynamic total miles, save migration. Validate both routes
   in sim.py before shipping.
3. **Event pool expansion** to ~15 (snakebite, abandoned wagon, friendly
   caravan trade, oxen stray). Pure content; respect convention #6.
4. Difficulty presets (Greenhorn/Settler/Pioneer) scaling event rate + prices.
5. Asset pass: landmark illustrations, textured parchment, ambient audio files.

## Test checklist before calling it done
- [ ] Title → 3-step setup wizard (name+trade / departure / party 3-of-8) →
      outfit (cart +/- with checkout; Depart locked until food > 0) → travel
- [ ] Travel screen fits one viewport, no scroll, on 375px mobile AND desktop
- [ ] Store opens as full-screen page; cart guards (budget, 800 food, 3 spares,
      2 tonics); Rare Goods appear at Table Rock (1300) and Comb Ridge (1850)
- [ ] Hunt minigame (Fire/Withdraw), Pan near Tinpan Creek, Rest, Camp-until-season
- [ ] Rivers: ferry (depth-priced), gold-dust fare, float, ford; Broadback rolls 5-9 ft
- [ ] Endings reachable: win, party death, stranded (0 oxen), plague (no tonic
      past mile 500) — temporarily lower TOTAL/plague gate to test, then restore
- [ ] Refresh mid-run → Resume works; save link → new browser profile restores;
      two-tap reset wipes from travel and outfit
- [ ] Journal overlay opens/closes; profession perks visible in store prices
      (Farmer ox $19, Clerk 10% off)

---

# v1.1 — SHIPPED 2026-08-23

Roadmap items 1–4 complete; item 5 shipped as a zero-binary-asset pass (see
below). Everything above this line is the frozen v1.0 record; the balance
tables below **supersede** the v1.0 table.

## What shipped

1. **Share/result card** — canvas-rendered 1200×630 run card on the end
   screen (rank title, stats, roster with † for the dead, route/difficulty
   byline, site URL). Share via Web Share API → clipboard → download
   fallback chain. Rank titles: Wagon Master / Trail Captain / Weathered
   Pilot / The Last Walker (wins by survivors); Taken at the Water /
   Stranded in the Dust / Given to the Trail (losses by cause).
2. **The Fork** — at Devil's Backbone (mile 1480): the Long Road (original
   2,300-mi route) or the Mountain Cutoff (2,050 mi; Windscour Saddle,
   The Scree Gates, Broadback Narrows crossed at 6–9 ft, Cold Hollow; no
   trading posts; −2 health/day past the fork; event trigger ×1.75).
   Route-aware trail map with a ghost hint of the road not taken. Save
   format v2 (`route`, `fork`, `difficulty`); v1 saves migrate (past 1480 →
   long road).
3. **Event pool 9 → 15** — snakebite (0.6), abandoned wagon (0.8), eastbound
   caravan (0.7), oxen stray (0.5, 5% loss), hailstorm (0.4), wild honey
   (0.7). The scaled trigger `(0.35+boost) × (Σall/Σlegacy)` keeps every
   v1.0 event at its exact original per-day odds; the new pool rides on top
   (~9%/day). Do not change a weight without re-running sim.py.
4. **Difficulty presets** — Greenhorn (events ×0.8, prices ×0.9), Settler
   (×1.0 — byte-identical to v1.0), Pioneer (events ×1.2, prices ×1.15).
   Chosen on the Season step; scales store+gear prices and the event
   trigger only.
5. **Asset pass** (zero binary assets, by design): selection-UI iconography
   (professions, departures, party, store items, rare goods — lucide +
   custom engraved-style SVGs), wagon-wheel brand mark in the dividers and
   journal, parchment texture (inline feTurbulence data-URI), mountain
   vignette at the fork, and a synthesized ambient bed (wind, winter howl,
   river wash at crossings, spring/summer birdsong). Deliberate deviation:
   the roadmap said "ambient audio files" — ambience is synthesized instead
   to keep the no-files/no-backend architecture. Landmark illustrations
   remain open for a future pass.

## Balance spec v1.1 — verified state (n=4000/cell, optimal bot, ±1.5)

Skilled humans still land ~10–15 pts lower. Baseline check reproduced the
v1.0 table (67.8/49.2/47.7) before the new pool was enabled.

| Difficulty | Route | Clerk | Carpenter | Farmer |
|---|---|---|---|---|
| Greenhorn | Long Road | 85% | 71% | 65% |
| Greenhorn | Cutoff | 82% | 67% | 61% |
| **Settler** | **Long Road** | **68%** | **47%** | **45%** |
| Settler | Cutoff | 62% | 42% | 40% |
| Pioneer | Long Road | 49% | 30% | 30% |
| Pioneer | Cutoff | 41% | 25% | 24% |

Reading: the new event pool costs ≤2.5 pts vs v1.0 at Settler/Long (within
spec identity); the cutoff prices its 250 saved miles at 4–6 win pts and
~3–8 median days — worth it when racing winter, not otherwise; difficulty
moves win rates ±16–24 pts. Oxen loss remains the top cause of death
everywhere; lame-ox weight is untouched from v1.0.

New dials (mirror in `sim.py` `SHIPPED` dict before touching):
`cutEvent=1.75`, `cutHealth=2`, `snakeW=0.6`, `strayW=0.5`,
`strayLoss=0.05`, `hailW=0.4`, `honeyW=0.7`, `DIFF` mults above.
Run `python tools/sim.py [n]` — prints baseline check, v1.1 pool check,
and the full 18-cell matrix (results archived in
`tools/sim-results-v1.1.txt`).

## v1.1 test checklist (all verified pre-ship)

- [x] Baseline sim reproduces v1.0 table with new events disabled
- [x] Fork appears on crossing 1480; both choices; map/total/landmarks swap
- [x] Broadback Narrows rolls 6–10 ft on the cutoff
- [x] Difficulty selector on Season step; Pioneer prices verified in store
      (Clerk food100 $35, ox $40)
- [x] Result card renders 1200×630 on win AND loss; save/share buttons
- [x] Save v2 roundtrip via link; v1 saves hydrate (route inferred)
- [x] No page scroll at 375×667 and desktop on all touched screens
- [ ] v1.2 candidates: landmark illustrations, difficulty on the result
      card art, cutoff-specific events (scree slide, thin-air fever)
