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
