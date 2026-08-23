# Wagon West

2,300 miles of open country. Not everyone makes it.

A frontier survival game in the Oregon Trail tradition — entirely original IP.
Client-side only: no backend, no database, no auth. All audio is synthesized
in-browser; saves live in localStorage, with shareable save links via the URL
hash.

v1.1: three difficulty presets, the fork at Devil's Backbone (Long Road vs
Mountain Cutoff), 15 trail events, and a shareable result card at journey's
end.

## Develop

```
npm install
npm run dev
```

## Build

```
npm run build
npm run preview
```

## Balance

Game tuning was derived from ~60,000 Monte Carlo runs. Any balance change must
be mirrored in `tools/sim.py` and re-validated (`python3 tools/sim.py`) before
shipping. See [HANDOFF.md](HANDOFF.md) for the balance spec, design
conventions, and roadmap.
