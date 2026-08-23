import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Heart, Wheat, Coins, Wrench, Users, Skull, Compass, Flag,
  BookOpen, Volume2, VolumeX, Crosshair, Tent, Droplet, Gem, RotateCcw,
  Link2, Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// WAGON WEST v2 — client-side frontier survival journal
// All audio is synthesized in-browser (Web Audio API). No files, no backend.
// ---------------------------------------------------------------------------

// Persistence: localStorage behind the async surface the component was
// written against.
const storageAdapter = {
  async get(key) {
    const v = localStorage.getItem(key);
    return v != null ? { value: v } : null;
  },
  async set(key, value) { localStorage.setItem(key, value); },
  async delete(key) { localStorage.removeItem(key); },
};

const LANDMARKS = [
  { name: "Widow's Creek", short: "Widow's Ck", miles: 0 },
  { name: "Split Rock Pass", short: "Split Rock", miles: 210 },
  { name: "Tinpan Creek", short: "Tinpan Ck", miles: 300, creek: true },
  { name: "Cotton Ridge", short: "Cotton Rdg", miles: 430, store: true },
  { name: "Broken Kettle Ford", short: "Brkn Kettle", miles: 640, river: true },
  { name: "Antelope Flats", short: "Antelope", miles: 860 },
  { name: "Sourwood Crossing", short: "Sourwood", miles: 1080, river: true },
  { name: "Table Rock Trading Post", short: "Table Rock", miles: 1300, store: true },
  { name: "Devil's Backbone", short: "Devil's Bkbn", miles: 1480 },
  { name: "Salt Meadow", short: "Salt Mdw", miles: 1660 },
  { name: "Comb Ridge", short: "Comb Rdg", miles: 1850, store: true },
  { name: "The Broadback", short: "Broadback", miles: 2050, river: true, big: true },
  { name: "Fallow Basin", short: "Fallow Bsn", miles: 2180 },
  { name: "Cutter's Valley (Journey's End)", short: "Cutter's Vly", miles: 2300 },
];
const TOTAL_MILES = LANDMARKS[LANDMARKS.length - 1].miles;

const STORE_PRICES = {
  food: { label: "Food (25 lbs)", cost: 9, food: 25 },
  food100: { label: "Food (100 lbs)", cost: 34, food: 100 },
  wheel: { label: "Spare Wheel", cost: 15, part: true },
  axle: { label: "Spare Axle", cost: 20, part: true },
  tongue: { label: "Spare Tongue", cost: 12, part: true },
  ox: { label: "Ox", cost: 38 },
  tonic: { label: "Cholera Tonic", cost: 30, tonic: true, postOnly: true },
};
const PART_CAP = 3; // wagon space — max spares of each kind

const GEAR = {
  musket: { label: "Rifled Musket", cost: 40, desc: "+20% meat from hunts" },
  toolkit: { label: "Wainwright's Kit", cost: 38, desc: "Some breakdowns mended without a spare" },
  sluice: { label: "Gold Sluice", cost: 28, desc: "Better odds panning" },
  oven: { label: "Dutch Oven", cost: 30, desc: "Rations stretch a little further" },
  medchest: { label: "Medicine Chest", cost: 45, desc: "Fevers hit half as hard" },
};
const FOOD_CAP = 800; // lbs — what one wagon can carry

const CANDIDATES = [
  { id: "doc", name: "Doc Merrill", role: "Physician", cost: 90, trait: "medic", desc: "+1 health to everyone, every day he lives." },
  { id: "hawk", name: "Hawkins", role: "Hunter", cost: 70, trait: "hunter", desc: "+25% meat from every hunt." },
  { id: "ruth", name: "Ruth Calder", role: "Blacksmith", cost: 60, trait: "smith", desc: "Half of all breakdowns fixed without a spare." },
  { id: "finch", name: "Old Finch", role: "Prospector", cost: 50, trait: "prospector", desc: "A sharper eye for gold in the gravel." },
  { id: "marta", name: "Marta", role: "Camp Cook", cost: 55, trait: "cook", desc: "Stretches every ration 15% further." },
  { id: "cole", name: "Cole", role: "Your cousin", cost: 0, trait: null, desc: "Willing hands, no particular gifts." },
  { id: "ada", name: "Ada", role: "Neighbor's kid", cost: 0, trait: null, desc: "Eager. Eats like everyone else." },
  { id: "wren", name: "Wren", role: "Drifter", cost: 0, trait: null, desc: "Quiet. Keeps walking." },
];

const PACES = {
  steady: { label: "Steady", miles: [12, 18], healthCost: 0, foodMult: 1 },
  strenuous: { label: "Strenuous", miles: [18, 26], healthCost: 2, foodMult: 1.15 },
  grueling: { label: "Grueling", miles: [24, 34], healthCost: 5, foodMult: 1.3 },
};
const RATIONS = {
  filling: { label: "Filling", perPerson: 3, healthDelta: 0 },
  meager: { label: "Meager", perPerson: 2, healthDelta: -1 },
  bare: { label: "Bare Bones", perPerson: 1, healthDelta: -3 },
};

const PROFESSIONS = [
  { id: "clerk", label: "Store Clerk", money: 900, note: "Deep pockets. 10% off at every store." },
  { id: "carpenter", label: "Carpenter", money: 650, note: "Mends many breakdowns with his own hands, free." },
  { id: "farmer", label: "Farmer", money: 500, note: "Knows livestock. Oxen cost half." },
];

const HEALTH_LABEL = (h) => {
  if (h >= 80) return { text: "Hale", color: "text-emerald-800" };
  if (h >= 55) return { text: "Fair", color: "text-emerald-700" };
  if (h >= 35) return { text: "Poor", color: "text-amber-700" };
  if (h >= 15) return { text: "Grave", color: "text-rose-700" };
  return { text: "Failing", color: "text-rose-900" };
};

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const EPITAPHS = [
  "Traveled far. Rests now.",
  "Wagon held. Body did not.",
  "Gave all miles owed and some besides.",
  "The trail took what it was due.",
  "Went west anyway.",
];

const GOLD_PRICE = 18; // $ per oz at trading posts

// ---------------------------- seasons ----------------------------
const DEPARTURES = [
  { id: "apr", label: "Early April", doy: 91, note: "The classic window." },
  { id: "mar", label: "Mid-March", doy: 74, note: "Cold starts, longest season ahead." },
  { id: "may", label: "Early May", doy: 121, note: "Warm roads, tighter clock." },
  { id: "jun", label: "Early June", doy: 152, note: "A gamble against winter." },
];
const MONTHS = [["Jan",31],["Feb",28],["Mar",31],["Apr",30],["May",31],["Jun",30],["Jul",31],["Aug",31],["Sep",30],["Oct",31],["Nov",30],["Dec",31]];
function dateLabel(doy) {
  let d = ((doy - 1) % 365) + 1;
  for (const [m, len] of MONTHS) { if (d <= len) return `${m} ${d}`; d -= len; }
  return "Dec 31";
}
function seasonFor(doy) {
  const d = ((doy - 1) % 365) + 1;
  if (d >= 335 || d <= 59) return "winter";
  if (d <= 151) return "spring";
  if (d <= 243) return "summer";
  return "fall";
}
const SEASONS = {
  spring: { label: "Spring", travelMult: 0.95, healthPerDay: 0, huntMult: 1.0, panMult: 1.0 },
  summer: { label: "Summer", travelMult: 1.0, healthPerDay: 0, huntMult: 1.0, panMult: 1.0 },
  fall:   { label: "Fall",   travelMult: 0.95, healthPerDay: -1, huntMult: 1.1, panMult: 0.9 },
  winter: { label: "Winter", travelMult: 0.6, healthPerDay: -4, huntMult: 0.5, panMult: 0.45 },
};

// Hand-drawn style SVG trail map. Wagon and landmarks are positioned along
// the actual curve via getPointAtLength, so progress follows the drawn path.
function TrailMap({ miles, total }) {
  const pathRef = useRef(null);
  const [pts, setPts] = useState(null);
  const progress = clamp(miles / total, 0, 1);

  // path shifted down inside a taller framed viewBox
  const D = "M 18,106 C 70,72 92,116 142,92 C 175,76 200,48 250,64 C 295,78 330,100 382,40";

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const L = path.getTotalLength();
    setPts({
      lm: LANDMARKS.map((l) => path.getPointAtLength((l.miles / total) * L)),
      wagon: path.getPointAtLength(progress * L),
    });
  }, [miles, total, progress]);

  const Pine = ({ x, y, s = 1 }) => (
    <g transform={"translate(" + x + "," + y + ") scale(" + s + ")"} opacity="0.45">
      <polygon points="0,-7 4,1 -4,1" fill="#4c7d58" />
      <polygon points="0,-3 5,5 -5,5" fill="#4c7d58" />
      <rect x="-0.8" y="5" width="1.6" height="3" fill="#6e8474" />
    </g>
  );

  const clampX = (x) => Math.min(370, Math.max(30, x));

  return (
    <svg viewBox="0 0 400 150" style={{ width: "100%", maxHeight: "23vh", display: "block", border: "1px solid #c3c6a8", background: "#ece9d6", borderRadius: 3 }}>
      {/* double map frame */}
      <rect x="3" y="3" width="394" height="144" fill="none" stroke="#c3c6a8" strokeWidth="1.5" />
      <rect x="7" y="7" width="386" height="136" fill="none" stroke="#c3c6a8" strokeWidth="0.5" opacity="0.7" />

      {/* cartouche */}
      <text x="200" y="17" fontSize="7.5" textAnchor="middle" fontFamily="monospace" letterSpacing="3" fill="#6e8474">THE WESTERN TRAIL · {total} MI</text>

      {/* compass rose */}
      <g transform="translate(28,28)" opacity="0.6">
        <circle r="8" fill="none" stroke="#6e8474" strokeWidth="0.8" />
        <polygon points="0,-7 2,0 0,2 -2,0" fill="#3f7a4e" />
        <text y="-11" fontSize="6" textAnchor="middle" fontFamily="monospace" fill="#6e8474">N</text>
      </g>

      {/* terrain: pines + hills */}
      <Pine x={54} y={32} /><Pine x={72} y={40} s={0.8} /><Pine x={40} y={48} s={0.7} />
      <Pine x={348} y={124} /><Pine x={366} y={116} s={0.75} />
      <Pine x={218} y={130} s={0.85} /><Pine x={240} y={135} s={0.65} />
      <g opacity="0.4" stroke="#6e8474" strokeWidth="1" fill="none">
        <path d="M 285,32 q 14,-11 28,0" />
        <path d="M 312,38 q 11,-9 22,0" />
        <path d="M 120,135 q 13,-10 26,0" />
      </g>

      {/* trail */}
      <path ref={pathRef} d={D} fill="none" stroke="#c3c6a8" strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" />
      <path d={D} fill="none" stroke="#3f7a4e" strokeWidth="3" strokeLinecap="round" pathLength="1" strokeDasharray={progress + " 1"} />

      {/* river squiggles at crossings */}
      {pts && LANDMARKS.map((l, i) => l.creek ? (
        <g key={"ck" + i} transform={"translate(" + pts.lm[i].x + "," + pts.lm[i].y + ")"} stroke="#4a6a8a" strokeWidth="1" fill="none" opacity="0.55">
          <path d="M -9,-10 q 3,2 4,6 q 1,4 4,6" />
        </g>
      ) : l.river ? (
        <g key={"rv" + i} transform={"translate(" + pts.lm[i].x + "," + pts.lm[i].y + ")" + (l.big ? " scale(1.35)" : "")} stroke="#4a6a8a" strokeWidth="1.2" fill="none" opacity="0.85">
          <path d="M -12,-14 q 4,3 6,8 q 2,5 5,8 q 3,3 4,8" />
          <path d="M -16,-11 q 4,3 6,8 q 2,5 5,8 q 3,3 4,8" opacity="0.5" />
        </g>
      ) : null)}

      {/* landmarks + labels */}
      {pts && pts.lm.map((p, i) => {
        const l = LANDMARKS[i];
        const isNext = l.miles === (LANDMARKS.find((x) => x.miles > miles) || LANDMARKS[LANDMARKS.length - 1]).miles;
        const isEnd = i === LANDMARKS.length - 1;
        const labeled = l.store || l.river || l.creek || isNext || isEnd || i === 0;
        const above = i % 2 === 0;
        const ly = above ? Math.max(24, p.y - 10) : Math.min(142, p.y + 16);
        return (
          <g key={l.name}>
            {isNext && <circle cx={p.x} cy={p.y} r="7" fill="none" stroke="#3f7a4e" strokeWidth="1" strokeDasharray="2 2" />}
            <circle cx={p.x} cy={p.y} r={l.store || l.river || isEnd ? 4 : 2.5}
              fill={isEnd ? "#4c7d58" : l.store ? "#c9a227" : l.river || l.creek ? "#4a6a8a" : "#6e8474"}
              stroke="#f6f3e4" strokeWidth="1" />
            {labeled && (
              <text x={clampX(p.x)} y={ly} fontSize="7" textAnchor="middle"
                fontFamily="monospace" fontWeight={isNext ? "bold" : "normal"}
                fill={isNext ? "#3f7a4e" : "#6e8474"}>
                {l.short}{l.store ? " $" : ""}{l.river || l.creek ? " ~" : ""}
              </text>
            )}
          </g>
        );
      })}

      {/* wagon glyph */}
      {pts && (
        <g transform={"translate(" + pts.wagon.x + "," + pts.wagon.y + ")"}>
          <circle r="10" fill="#3f7a4e" opacity="0.15" />
          <rect x="-5.5" y="-6" width="11" height="5.5" rx="2.5" fill="#22392b" stroke="#f6f3e4" strokeWidth="0.9" />
          <circle cx="-3" cy="1.5" r="2.1" fill="#22392b" stroke="#f6f3e4" strokeWidth="0.8" />
          <circle cx="3" cy="1.5" r="2.1" fill="#22392b" stroke="#f6f3e4" strokeWidth="0.8" />
        </g>
      )}
    </svg>
  );
}

export default function WagonWest() {
  const [screen, setScreen] = useState("title");
  const [leaderName, setLeaderName] = useState("");
  const [profession, setProfession] = useState(PROFESSIONS[0].id);
  const [departure, setDeparture] = useState("apr");
  const [picked, setPicked] = useState([]);
  const [members, setMembers] = useState([]);
  const [pace, setPace] = useState("steady");
  const [rations, setRations] = useState("filling");
  const [money, setMoney] = useState(0);
  const [food, setFood] = useState(0);
  const [parts, setParts] = useState({ wheel: 1, axle: 1, tongue: 1 });
  const [oxen, setOxen] = useState(4);
  const [gold, setGold] = useState(0);
  const [day, setDay] = useState(1);
  const [miles, setMiles] = useState(0);
  const [log, setLog] = useState([]);
  const [ending, setEnding] = useState(null);
  const [atStore, setAtStore] = useState(false);
  const [canReenter, setCanReenter] = useState(false);
  const [cart, setCart] = useState({});
  const [gear, setGear] = useState({});
  const [tonics, setTonics] = useState(0);
  const [showJournal, setShowJournal] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [river, setRiver] = useState(null);      // { name, depth }
  const [hunt, setHunt] = useState(null);        // { pos }
  const [soundOn, setSoundOn] = useState(true);
  const [hasSave, setHasSave] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const logEndRef = useRef(null);
  const prevMembersRef = useRef([]);
  const soundOnRef = useRef(true);
  const audioRef = useRef({ ctx: null, musicTimer: null });
  const huntTimerRef = useRef(null);
  const lastHuntDayRef = useRef(-99);

  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

  // ---------------------------- SAVE / RESUME (per-user persistent storage) --
  const SAVE_KEY = "wagonwest-save-v1";

  useEffect(() => {
    (async () => {
      try {
        const res = await storageAdapter.get(SAVE_KEY);
        if (res?.value) setHasSave(true);
      } catch (e) { /* no save or storage unavailable */ }
    })();
  }, []);

  function buildSavePayload() {
    return JSON.stringify({
      v: 1, screen, leaderName, profession, departure, members, pace, rations,
      money, gold, food, parts, oxen, day, miles, log: log.slice(-40),
      atStore, canReenter, river, gear, tonics,
    });
  }

  // auto-save whenever the journey state moves (travel or outfitting)
  useEffect(() => {
    if (screen !== "travel" && screen !== "outfit") return;
    const payload = buildSavePayload();
    (async () => {
      try { await storageAdapter.set(SAVE_KEY, payload); setHasSave(true); } catch (e) { /* best effort */ }
    })();
  }, [day, screen, money, gold, food, oxen, atStore, river]);

  async function clearSave() {
    try { await storageAdapter.delete(SAVE_KEY); } catch (e) { /* may not exist */ }
    setHasSave(false);
  }

  function hydrateFrom(s) {
    setLeaderName(s.leaderName || "");
    setProfession(s.profession || PROFESSIONS[0].id);
    setDeparture(s.departure || "apr");
    setMembers(s.members || []);
    prevMembersRef.current = s.members || [];
    setPace(s.pace || "steady");
    setRations(s.rations || "filling");
    setMoney(s.money ?? 0);
    setGold(s.gold ?? 0);
    setFood(s.food ?? 0);
    setParts(s.parts || { wheel: 1, axle: 1, tongue: 1 });
    setOxen(s.oxen ?? 4);
    setDay(s.day ?? 1);
    setMiles(s.miles ?? 0);
    setLog(s.log || []);
    setEnding(null);
    setAtStore(!!s.atStore);
    setCart({});
    setGear(s.gear || {});
    setTonics(s.tonics || 0);
    setCanReenter(!!s.canReenter);
    setRiver(s.river || null);
    setHunt(null);
    sfx.start();
    setScreen(s.screen === "outfit" ? "outfit" : "travel");
  }

  async function resumeGame() {
    try {
      const res = await storageAdapter.get(SAVE_KEY);
      if (!res?.value) { setHasSave(false); return; }
      hydrateFrom(JSON.parse(res.value));
    } catch (e) {
      setHasSave(false);
    }
  }

  // shareable save links: a #save= hash in the URL beats localStorage on load
  useEffect(() => {
    const m = location.hash.match(/[#&]save=([^&]+)/);
    if (!m) return;
    try {
      hydrateFrom(JSON.parse(decodeURIComponent(atob(m[1]))));
    } catch (e) { /* malformed link: ignore silently */ }
    history.replaceState(null, "", location.pathname + location.search);
  }, []);

  async function copySaveLink() {
    try {
      location.hash = "save=" + btoa(encodeURIComponent(buildSavePayload()));
      const url = location.href;
      try {
        await navigator.clipboard.writeText(url);
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setLinkCopied(true);
      sfx.coin();
      setTimeout(() => setLinkCopied(false), 1800);
    } catch (e) { /* clipboard unavailable */ }
  }

  // a finished run clears its save
  useEffect(() => { if (screen === "end") clearSave(); }, [screen]);

  function handleResetTap() {
    if (!resetArmed) {
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 3000);
    } else {
      setResetArmed(false);
      restart();
    }
  }

  // ---------------------------- AUDIO (all synthesized) ----------------------
  function getCtx() {
    if (!audioRef.current.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioRef.current.ctx = new AC();
    }
    if (audioRef.current.ctx.state === "suspended") audioRef.current.ctx.resume();
    return audioRef.current.ctx;
  }

  function tone(freq, dur = 0.2, type = "triangle", vol = 0.12, when = 0) {
    if (!soundOnRef.current) return;
    try {
      const ctx = getCtx();
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* audio unavailable; play on silently */ }
  }

  function noiseBurst(dur = 0.12, vol = 0.2) {
    if (!soundOnRef.current) return;
    try {
      const ctx = getCtx();
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = vol;
      src.buffer = buf;
      src.connect(g); g.connect(ctx.destination);
      src.start();
    } catch (e) { /* ignore */ }
  }

  const sfx = {
    good: () => { tone(523, 0.12); tone(659, 0.12, "triangle", 0.12, 0.12); tone(784, 0.25, "triangle", 0.12, 0.24); },
    bad: () => { tone(196, 0.25, "sawtooth", 0.08); tone(147, 0.4, "sawtooth", 0.08, 0.2); },
    landmark: () => { tone(880, 0.5, "sine", 0.1); tone(1318, 0.45, "sine", 0.07, 0.08); },
    coin: () => { tone(988, 0.08, "square", 0.06); tone(1319, 0.12, "square", 0.06, 0.08); },
    shot: () => { noiseBurst(0.15, 0.25); tone(90, 0.1, "square", 0.15); },
    death: () => { tone(110, 1.4, "sine", 0.1); tone(104, 1.4, "sine", 0.08, 0.05); },
    water: () => { noiseBurst(0.5, 0.08); tone(330, 0.3, "sine", 0.05, 0.1); },
    start: () => { tone(262, 0.2); tone(330, 0.2, "triangle", 0.12, 0.18); tone(392, 0.2, "triangle", 0.12, 0.36); tone(523, 0.45, "triangle", 0.12, 0.54); },
  };

  // slow pentatonic campfire loop while traveling
  useEffect(() => {
    const MELODY = [220, 262, 294, 220, 330, 294, 262, 196];
    function playPhrase() {
      MELODY.forEach((f, i) => tone(f, 0.55, "sine", 0.045, i * 0.7));
    }
    if (screen === "travel" && soundOn) {
      playPhrase();
      audioRef.current.musicTimer = setInterval(playPhrase, 9000);
    }
    return () => { if (audioRef.current.musicTimer) clearInterval(audioRef.current.musicTimer); };
  }, [screen, soundOn]);

  // ---------------------------- derived ----------------------------
  const nextLandmark = useMemo(
    () => LANDMARKS.find((l) => l.miles > miles) || LANDMARKS[LANDMARKS.length - 1],
    [miles]
  );
  const lastLandmark = useMemo(
    () => [...LANDMARKS].reverse().find((l) => l.miles <= miles) || LANDMARKS[0],
    [miles]
  );
  const livingCount = members.filter((m) => m.health > 0).length;
  const busy = atStore || !!river || !!hunt;
  const hasTrait = (t) => members.some((m) => m.trait === t && m.health > 0);
  const addFood = (amt) => setFood((f) => clamp(f + amt, 0, FOOD_CAP));
  const dailyFood = () => Math.round(RATIONS[rations].perPerson * livingCount * (hasTrait("cook") ? 0.85 : 1) * (gear.oven ? 0.92 : 1));

  // season derivation
  const startDoy = (DEPARTURES.find((d) => d.id === departure) || DEPARTURES[1]).doy;
  const doy = startDoy + day - 1;
  const season = seasonFor(doy);
  const seasonCfg = SEASONS[season];
  const prevSeasonRef = useRef(null);

  function pushLog(text, kind = "normal") {
    setLog((l) => [...l, { day, text, kind, id: `${day}-${l.length}-${Math.random()}` }]);
  }

  // season-change journal entries
  useEffect(() => {
    if (screen !== "travel") { prevSeasonRef.current = season; return; }
    if (prevSeasonRef.current && prevSeasonRef.current !== season) {
      const msgs = {
        summer: "Summer settles over the trail. Long days, hard sun.",
        fall: "First cold nights of fall. The passes ahead won't wait forever.",
        winter: "Winter has come. Snow slows the wagon and the cold gnaws at everyone.",
        spring: "The thaw of spring. The worst of the cold is behind you.",
      };
      pushLog(msgs[season], season === "winter" ? "bad" : "landmark");
      if (season === "winter") sfx.bad(); else sfx.landmark();
    }
    prevSeasonRef.current = season;
  }, [season, screen]);

  // ---------------------------- lifecycle ----------------------------
  function prepareJourney() {
    const prof = PROFESSIONS.find((p) => p.id === profession);
    const chosen = picked.map((id) => CANDIDATES.find((c) => c.id === id)).filter(Boolean);
    const wages = chosen.reduce((s, c) => s + c.cost, 0);
    if (chosen.length !== 3 || wages > prof.money) return;
    const party = [
      { name: leaderName || "The Leader", health: 100, trait: null, role: "Leader" },
      ...chosen.map((c) => ({ name: c.name, health: 100, trait: c.trait, role: c.role })),
    ];
    setMembers(party);
    prevMembersRef.current = party;
    setMoney(prof.money - wages);
    setFood(0);
    setParts({ wheel: 0, axle: 0, tongue: 0 });
    setOxen(4);
    setGold(0);
    setDay(1);
    setMiles(0);
    setLog([]);
    setEnding(null);
    setAtStore(false);
    setRiver(null);
    setHunt(null);
    setCart({});
    setGear({});
    setTonics(0);
    setScreen("outfit");
  }

  function departJourney() {
    const partyLeader = leaderName || "The Leader";
    setLog((l) => [...l, { day: 1, text: `${partyLeader} sets out from Widow's Creek with 4 souls, $${money} remaining, and a wagon full of hope.`, kind: "normal", id: "start" }]);
    sfx.start();
    setScreen("travel");
  }

  function applyHealthDelta(delta, targetIdx = null) {
    setMembers((prev) =>
      prev.map((m, i) => {
        if (targetIdx !== null && i !== targetIdx) return m;
        if (m.health <= 0) return m;
        return { ...m, health: clamp(m.health + delta, 0, 100) };
      })
    );
  }

  // death notices
  useEffect(() => {
    const prev = prevMembersRef.current;
    members.forEach((m, i) => {
      const was = prev[i];
      if (was && was.health > 0 && m.health <= 0) {
        pushLog(`${m.name} has died on the trail.`, "bad");
        sfx.death();
      }
    });
    prevMembersRef.current = members;
    if (screen === "travel" && members.length > 0 && members.every((m) => m.health <= 0)) {
      setEnding({ type: "loss", days: day, epitaph: pick(EPITAPHS) });
      setScreen("end");
    }
  }, [members]);

  // stranded: no oxen, no wagon, no trail
  useEffect(() => {
    if (screen !== "travel" || ending) return;
    if (oxen <= 0) {
      setEnding({ type: "loss", days: day, cause: "oxen", epitaph: pick(EPITAPHS) });
      sfx.death();
      setScreen("end");
    }
  }, [oxen]);

  // win detection: fires only if at least one soul is still breathing
  useEffect(() => {
    if (screen !== "travel" || ending) return;
    const alive = members.filter((m) => m.health > 0).length;
    if (miles >= TOTAL_MILES && alive > 0) {
      setEnding({ type: "win", survivors: alive, moneyLeft: money, days: day });
      sfx.good();
      setScreen("end");
    }
  }, [miles, members]);

  // ---------------------------- events ----------------------------
  function rollEvent(paceCfg, dayMiles, crossed) {
    const roll = Math.random();
    const riskBoost = paceCfg === PACES.grueling ? 0.12 : paceCfg === PACES.strenuous ? 0.05 : 0;
    if (roll > 0.35 + riskBoost) return;

    const pool = [
      { w: 3, run: () => {
          const dmg = Math.round(rand(6, 16) * (gear.medchest ? 0.5 : 1));
          const living = members.map((m, i) => ({ i, h: m.health })).filter((x) => x.h > 0);
          const weakest = living.length ? living.reduce((a, b) => (b.h < a.h ? b : a)) : null;
          const who = weakest && Math.random() < 0.6 ? weakest.i : Math.floor(Math.random() * members.length);
          applyHealthDelta(-dmg, who);
          pushLog(`Fever in the wagon. ${members[who]?.name || "Someone"} wakes shivering. Health falls.`, "bad");
          sfx.bad();
        } },
      { w: 2, run: () => {
          const part = pick(["wheel", "axle", "tongue"]);
          const partName = { wheel: "wheel", axle: "axle", tongue: "wagon tongue" }[part];
          if (hasTrait("smith") && Math.random() < 0.5) {
            pushLog(`The ${partName} gives way, but your blacksmith mends it by firelight. No spare spent.`, "good");
            sfx.good();
            return;
          }
          if (gear.toolkit && Math.random() < 0.35) {
            pushLog(`The ${partName} gives way, but the wainwright's kit sees it mended. No spare spent.`, "good");
            sfx.good();
            return;
          }
          if (profession === "carpenter" && Math.random() < 0.4) {
            pushLog(`The ${partName} gives way — and you true it back yourself by morning. Carpenter's hands. No spare spent.`, "good");
            sfx.good();
            return;
          }
          const hadPart = parts[part] > 0;
          setParts((p) => ({ ...p, [part]: Math.max(0, p[part] - 1) }));
          if (hadPart) {
            pushLog(`The ${partName} breaks on a rut. You fit the spare and roll on.`, "normal");
          } else {
            applyHealthDelta(-4);
            pushLog(`The ${partName} breaks and there is no spare. A hard day of makeshift repairs wears everyone down.`, "bad");
            sfx.bad();
          }
        } },
      { w: 2, run: () => {
          const gain = Math.round(rand(15, 40));
          addFood(gain);
          pushLog(`A stroke of luck: game wanders near camp. +${gain} lbs of food.`, "good");
          sfx.good();
        } },
      { w: 2, run: () => {
          const lost = Math.round(rand(10, 30));
          setFood((f) => Math.max(0, f - lost));
          pushLog(`Rain gets into the flour sacks. ${lost} lbs of food lost to rot.`, "bad");
          sfx.bad();
        } },
      { w: 1, run: () => {
          const targets = [];
          if (money > 10) { targets.push("money"); targets.push("money"); }
          if (food > 30) { targets.push("food"); targets.push("food"); }
          if (parts.wheel + parts.axle + parts.tongue > 0) targets.push("spare");
          if (oxen > 0) targets.push("ox");
          if (gold >= 0.3) targets.push("gold");
          const t = targets.length ? pick(targets) : "money";
          if (t === "money") {
            const stolen = Math.round(rand(20, 60));
            setMoney((m) => Math.max(0, m - stolen));
            pushLog("Thieves in the night make off with $" + stolen + ".", "bad");
          } else if (t === "food") {
            const stolen = Math.round(rand(20, 50));
            setFood((f) => Math.max(0, f - stolen));
            pushLog("Thieves in the night make off with " + stolen + " lbs of food.", "bad");
          } else if (t === "spare") {
            const have = ["wheel", "axle", "tongue"].filter((k) => parts[k] > 0);
            const k = pick(have);
            setParts((p) => ({ ...p, [k]: Math.max(0, p[k] - 1) }));
            pushLog("Thieves in the night make off with a spare " + (k === "tongue" ? "wagon tongue" : k) + ".", "bad");
          } else if (t === "ox") {
            setOxen((o) => Math.max(0, o - 1));
            pushLog("Rustlers cut an ox loose in the dark and drive it off.", "bad");
          } else {
            const lost = gold;
            setGold(0);
            pushLog("Thieves find the dust pouch. " + lost + " oz of gold — gone.", "bad");
          }
          sfx.bad();
        } },
      { w: 1, run: () => {
          const burned = Math.round(food * rand(0.12, 0.22));
          setFood((f) => Math.max(0, f - burned));
          const have = ["wheel", "axle", "tongue"].filter((k) => parts[k] > 0);
          const k = have.length ? pick(have) : null;
          if (k) setParts((p) => ({ ...p, [k]: Math.max(0, p[k] - 1) }));
          pushLog("Fire spreads from the cookfire in the night. " + burned + " lbs of provisions burn" + (k ? ", along with a spare " + (k === "tongue" ? "wagon tongue" : k) : "") + " before it's beaten out.", "bad");
          sfx.bad();
        } },
      { w: 2, run: () => {
          applyHealthDelta(4);
          pushLog("Fair weather and firm ground. Everyone rests a little easier.", "good");
          sfx.good();
        } },
      { w: crossed ? 0 : 2, run: () => {
          const lost = Math.round((dayMiles || 0) * 0.7);
          setMiles((m) => Math.max(0, m - lost));
          pushLog("Rain turns the trail to soup. The wagon claws forward and slides back — most of the day's miles are lost.", "bad");
          sfx.bad();
        } },
      { w: paceCfg === PACES.grueling ? 2.25 : paceCfg === PACES.strenuous ? 1.5 : 0.75, run: () => {
          setOxen((o) => Math.max(0, o - 1));
          pushLog(paceCfg === PACES.grueling
            ? "Driven hard at a grueling pace, an ox pulls up lame and has to be let go."
            : paceCfg === PACES.strenuous
            ? "The strenuous pace tells on the team. An ox pulls up lame and is let go."
            : "An ox pulls up lame and has to be let go. The team pulls harder now.", "bad");
          sfx.bad();
        } },
    ];
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    for (const p of pool) { r -= p.w; if (r <= 0) { p.run(); return; } }
  }

  // ---------------------------- actions ----------------------------
  function travelOneDay() {
    if (ending || busy) return;
    setCanReenter(false);
    const paceCfg = PACES[pace];
    const rationCfg = RATIONS[rations];

    const oxFactor = clamp(oxen / 4, 0.55, 1.15);
    const distance = Math.round(rand(paceCfg.miles[0], paceCfg.miles[1]) * oxFactor * seasonCfg.travelMult);
    const foodNeeded = Math.round(dailyFood() * (paceCfg.foodMult || 1));

    let newFood = food - foodNeeded;
    let starving = false;
    if (newFood < 0) { starving = true; newFood = 0; }
    setFood(newFood);

    if (paceCfg.healthCost) applyHealthDelta(-paceCfg.healthCost);
    applyHealthDelta(rationCfg.healthDelta);
    if (seasonCfg.healthPerDay) applyHealthDelta(seasonCfg.healthPerDay);
    if (hasTrait("medic")) applyHealthDelta(1);
    if (season === "winter" && Math.random() < 0.012) {
      setOxen((o) => Math.max(0, o - 1));
      pushLog("An ox goes down in the cold and cannot rise. The team pulls one short.", "bad");
      sfx.bad();
    }
    if (starving) { applyHealthDelta(-12); }

    const newMiles = clamp(miles + distance, 0, TOTAL_MILES);
    setMiles(newMiles);

    const crossed = LANDMARKS.find((l) => l.miles > miles && l.miles <= newMiles);
    if (crossed) {
      pushLog(`The party reaches ${crossed.name}.`, "landmark");
      sfx.landmark();
      if (crossed.store) {
        setAtStore(true);
        setCart({});
        setCanReenter(false);
        pushLog("A trading post here. Time to restock before moving on.", "normal");
      }
      if (crossed.creek) {
        pushLog("Color in the gravel here — a pan might pay before the trading post ahead.", "good");
      }
      if (crossed.river) {
        const depth = Math.round(crossed.big ? rand(5, 9) : rand(2, 7));
        setRiver({ name: crossed.name, depth });
        pushLog(`A river blocks the way. The water runs about ${depth} feet deep.`, "normal");
        sfx.water();
      }
    } else {
      pushLog(`${distance} miles made${starving ? ", on empty stomachs" : ""}.`, starving ? "bad" : "normal");
    }

    rollEvent(paceCfg, distance, !!crossed);

    // cholera: only past mile 500 — the first post always gets a chance to sell you the tonic
    if (newMiles > 500 && Math.random() < 0.008) {
      if (tonics > 0) {
        setTonics((t) => t - 1);
        const who = Math.floor(Math.random() * members.length);
        applyHealthDelta(-Math.round(rand(25, 45)), who);
        pushLog("Cholera breaks out at the water's edge. The tonic is drawn and dosed — " + (members[who]?.name || "someone") + " survives the worst of it. One dose spent.", "bad");
        sfx.bad();
      } else {
        const wiped = members.map((m) => ({ ...m, health: 0 }));
        prevMembersRef.current = wiped;
        setMembers(wiped);
        setEnding({ type: "loss", days: day, cause: "plague", epitaph: "No medicine could be found." });
        sfx.death();
        setScreen("end");
        return;
      }
    }

    setDay((d) => d + 1);

  }

  function restOneDay() {
    if (ending || busy) return;
    const rationCfg = RATIONS[rations];
    setFood((f) => Math.max(0, f - dailyFood()));
    applyHealthDelta(8 + (seasonCfg.healthPerDay || 0));
    pushLog(season === "winter"
      ? "The party shelters for a day. The cold takes back some of what rest gives."
      : "The party makes camp for a full day. Wounds close, tempers cool.", "good");
    sfx.good();
    setDay((d) => d + 1);
  }

  // ---------------------------- hunting mini-game ----------------------------
  function startHunt() {
    if (ending || busy) return;
    setHunt({ pos: 0 });
  }

  useEffect(() => {
    if (!hunt) { if (huntTimerRef.current) clearInterval(huntTimerRef.current); return; }
    let pos = 0, dir = 1;
    huntTimerRef.current = setInterval(() => {
      pos += 3.2 * dir;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      setHunt((h) => (h ? { ...h, pos } : h));
    }, 16);
    return () => clearInterval(huntTimerRef.current);
  }, [!!hunt]);

  function fireShot() {
    if (!hunt) return;
    sfx.shot();
    const accuracy = clamp(100 - Math.abs(hunt.pos - 50) * 2.2, 0, 100);
    setFood((f) => Math.max(0, f - dailyFood()));
    const thin = day - lastHuntDayRef.current <= 3;
    lastHuntDayRef.current = day;
    const yieldAmt = Math.round((7 + accuracy * 0.5) * seasonCfg.huntMult * (hasTrait("hunter") ? 1.25 : 1) * (gear.musket ? 1.2 : 1) * (thin ? 0.6 : 1));
    if (thin) pushLog("Game runs thin — this stretch has been hunted hard already.", "normal");
    addFood(yieldAmt);
    if (accuracy >= 75) {
      pushLog(`A clean shot. The party dresses the kill: +${yieldAmt} lbs of meat.`, "good");
      sfx.good();
    } else if (accuracy >= 35) {
      pushLog(`A fair shot after a long chase: +${yieldAmt} lbs of meat.`, "normal");
    } else {
      pushLog(`A wild shot. Scraps and small game only: +${yieldAmt} lbs.`, "bad");
      if (Math.random() < 0.2) {
        const who = Math.floor(Math.random() * members.length);
        applyHealthDelta(-Math.round(rand(5, 12)), who);
        pushLog(`${members[who]?.name || "Someone"} takes a bad step in the brush.`, "bad");
      }
    }
    setHunt(null);
    setDay((d) => d + 1);
  }

  // ---------------------------- gold panning ----------------------------
  function panForGold() {
    if (ending || busy) return;
    const rationCfg = RATIONS[rations];
    setFood((f) => Math.max(0, f - dailyFood()));
    applyHealthDelta(season === "winter" ? -5 : -2);
    const nearRiver = LANDMARKS.some((l) => (l.river || l.creek) && Math.abs(l.miles - miles) < 130);
    // Balanced so an average pan day covers the party's food cost:
    // near water EV ~0.68 oz (~$12/day), far EV ~0.21 oz (~$3.75/day) vs ~$3.40/day food.
    // Winter cuts yields roughly in half — frozen creeks don't pay.
    const findChance = ((nearRiver ? 0.8 : 0.55) + (hasTrait("prospector") ? 0.12 : 0) + (gear.sluice ? 0.08 : 0)) * seasonCfg.panMult;
    if (Math.random() < findChance) {
      const oz = Math.round(rand(nearRiver ? 0.3 : 0.15, nearRiver ? 1.4 : 0.6) * 10) / 10;
      setGold((g) => Math.round((g + oz) * 10) / 10);
      pushLog(`A day bent over the pan pays off: ${oz} oz of gold dust.${nearRiver ? "" : " Slim pickings this far from water."}`, "good");
      sfx.coin();
    } else if (season === "winter") {
      pushLog("The creek runs low and dark under ice. Frozen fingers and nothing to show.", "bad");
    } else {
      pushLog("A long day of panning turns up nothing but gravel and sore backs.", "bad");
    }
    setDay((d) => d + 1);
  }

  function sellGold() {
    if (gold < 0.1) return;
    const earned = Math.round(gold * GOLD_PRICE);
    setMoney((m) => m + earned);
    pushLog(`Sold ${gold} oz of gold dust for $${earned}.`, "good");
    setGold(0);
    sfx.coin();
  }

  // ---------------------------- store ----------------------------
  function priceOf(key) {
    const item = STORE_PRICES[key];
    let c = item.food && season === "winter" ? item.cost * 2 : item.cost;
    if (key === "ox" && profession === "farmer") c = Math.round(c * 0.5);
    if (profession === "clerk") c = Math.round(c * 0.9);
    return c;
  }

  function buyItem(key) {
    const item = STORE_PRICES[key];
    const cost = priceOf(key);
    if (money < cost) return;
    if (item.food && food >= FOOD_CAP) {
      pushLog("The wagon can't carry another pound of food.", "bad");
      return;
    }
    setMoney((m) => m - cost);
    if (item.food) addFood(item.food);
    else if (key === "ox") setOxen((o) => o + 1);
    else setParts((p) => ({ ...p, [key]: p[key] + 1 }));
    pushLog(`Bought ${item.label.toLowerCase()} for $${cost}.`, "normal");
    sfx.coin();
  }

  // ---------------------------- river ----------------------------
  function resolveRiver(choice) {
    if (!river) return;
    const { depth } = river;
    if (choice === "ferry") {
      const fare = 10 + depth * 4;
      if (money < fare) return;
      setMoney((m) => m - fare);
      pushLog("The ferryman eyes the water, names his price, and takes $" + fare + " to pole the wagon across without incident.", "normal");
      sfx.coin();
    } else if (choice === "ferryGold") {
      const fare = 10 + depth * 4;
      const oz = Math.ceil((fare / 14) * 10) / 10;
      if (gold < oz) return;
      setGold((g) => Math.round((g - oz) * 10) / 10);
      pushLog("The ferryman has no scale and no trust — he takes " + oz + " oz of dust at a hard rate and poles the wagon across.", "normal");
      sfx.coin();
    } else if (choice === "ford") {
      if (depth <= 3 || Math.random() > 0.6) {
        pushLog("The oxen find their footing and the wagon fords the river safely.", "good");
        sfx.good();
      } else {
        const lostFood = Math.round(rand(20, 50));
        setFood((f) => Math.max(0, f - lostFood));
        applyHealthDelta(-10);
        const oxLost = Math.random() < 0.5;
        if (oxLost) setOxen((o) => Math.max(0, o - 1));
        pushLog(`The current catches the wagon mid-stream. ${lostFood} lbs of food swept away${oxLost ? ", and an ox is pulled under and drowned" : ""}. Everyone is soaked and battered.`, "bad");
        sfx.bad();
      }
      sfx.water();
    } else if (choice === "float") {
      if (Math.random() > 0.25) {
        pushLog("You caulk the wagon and float it across. Slow, tense, dry.", "good");
        sfx.good();
      } else {
        const lostFood = Math.round(rand(15, 40));
        setFood((f) => Math.max(0, f - lostFood));
        applyHealthDelta(-6);
        pushLog(`Water seeps through the caulking. ${lostFood} lbs of food ruined.`, "bad");
        sfx.bad();
      }
      sfx.water();
    }
    setFood((f) => Math.max(0, f - dailyFood()));
    setRiver(null);
    setDay((d) => d + 1);
  }

  // ---------------------------- wait out the season ----------------------------
  function daysUntilNextSeason() {
    let d = 1;
    while (d <= 100 && seasonFor(doy + d) === season) d++;
    return d;
  }

  function nextSeasonName() {
    return SEASONS[seasonFor(doy + daysUntilNextSeason())].label;
  }

  function waitForSeason() {
    if (ending || busy) return;
    const rationCfg = RATIONS[rations];
    const target = daysUntilNextSeason();
    const campDelta = (season === "winter" ? -1 : 1) + rationCfg.healthDelta + (hasTrait("medic") ? 1 : 0);

    // simulate locally, commit once
    let f = food;
    let healths = members.map((m) => m.health);
    let daysCamped = 0;
    let trapGain = 0;
    let spoilLoss = 0;
    let stopReason = null;

    for (let i = 0; i < target; i++) {
      const living = healths.filter((h) => h > 0).length;
      const need = Math.round(rationCfg.perPerson * living * (hasTrait("cook") ? 0.85 : 1));
      if (f < need) { stopReason = "food"; break; }
      f -= need;
      if (Math.random() < 0.08) { const g = Math.round(rand(10, 25)); f = Math.min(FOOD_CAP, f + g); trapGain += g; }
      if (Math.random() < 0.06) { const s = Math.round(rand(8, 20)); f = Math.max(0, f - s); spoilLoss += s; }
      healths = healths.map((h) => (h > 0 ? clamp(h + campDelta, 0, 100) : h));
      daysCamped++;
      if (Math.min(...healths.filter((h) => h > 0)) <= 12) { stopReason = "health"; break; }
    }

    if (daysCamped === 0) {
      pushLog("Not enough food to make camp for even a day.", "bad");
      sfx.bad();
      return;
    }

    setFood(Math.round(f));
    setMembers((prev) => prev.map((m, i) => ({ ...m, health: healths[i] })));
    pushLog(`The party makes long camp: ${daysCamped} days pass. ${trapGain > 0 ? `Trap lines bring in ${trapGain} lbs. ` : ""}${spoilLoss > 0 ? `${spoilLoss} lbs lost to spoilage. ` : ""}`.trim(), "normal");
    if (stopReason === "food") pushLog("Supplies ran too low to keep camp. The party breaks early.", "bad");
    if (stopReason === "health") pushLog("Sickness in camp forces a change of plans. The party breaks early.", "bad");
    if (!stopReason) sfx.landmark(); else sfx.bad();
    setDay((d) => d + daysCamped);
  }

  function restart() {
    clearSave();
    setSetupStep(0);
    setPicked([]);
    setCart({});
    setGear({});
    setShowJournal(false);
    setScreen("title");
    setLeaderName("");
    setHunt(null);
    setRiver(null);
    setAtStore(false);
    setCanReenter(false);
    setEnding(null);
  }

  // ---------------------------- render (real CSS — artifact-safe) ----------------------------
  const profNow = PROFESSIONS.find((p) => p.id === profession);
  const statusFor = (h) => h >= 80 ? { t: "Hale", c: "#33663f" } : h >= 55 ? { t: "Fair", c: "#4c7d58" } : h >= 35 ? { t: "Poor", c: "#b8860b" } : h >= 15 ? { t: "Grave", c: "#a8462f" } : { t: "Failing", c: "#7a2f1f" };
  const wages = picked.reduce((s, id) => s + (CANDIDATES.find((c) => c.id === id)?.cost || 0), 0);
  const barColor = (h) => h >= 55 ? "#4c7d58" : h >= 30 ? "#c9a227" : "#a8462f";
  const latestDay = log.length ? log[log.length - 1].day : null;
  const todays = latestDay != null ? log.filter((e) => e.day === latestDay).slice(-2) : [];
  const logColor = (k) => k === "bad" ? "#a8462f" : k === "good" ? "#33663f" : k === "landmark" ? "#22392b" : "#3c5a47";
  const foodDays = Math.max(0, Math.floor(food / Math.max(1, dailyFood())));

  // ---- store cart ----
  const cartQty = (k) => cart[k] || 0;
  const cartTotal = Object.entries(cart).reduce((s, [k, q]) => s + priceOf(k) * q, 0);
  const cartFoodAdd = Object.entries(cart).reduce((s, [k, q]) => s + ((STORE_PRICES[k].food || 0) * q), 0);
  const bump = (k, d) => {
    const item = STORE_PRICES[k];
    if (d > 0) {
      if (item.food && food + cartFoodAdd + item.food > FOOD_CAP) { sfx.bad(); return; }
      if (item.part && parts[k] + (cart[k] || 0) + 1 > PART_CAP) { sfx.bad(); return; }
      if (item.tonic && tonics + (cart[k] || 0) + 1 > 2) { sfx.bad(); return; }
      if (cartTotal + priceOf(k) > money) { sfx.bad(); return; }
    }
    setCart((prev) => ({ ...prev, [k]: Math.max(0, (prev[k] || 0) + d) }));
    sfx.coin();
  };
  const checkout = () => {
    if (cartTotal <= 0 || cartTotal > money) return;
    const names = { food: "25 lbs food", food100: "100 lbs food", wheel: "spare wheel", axle: "spare axle", tongue: "spare tongue", ox: "ox", tonic: "cholera tonic" };
    const bought = Object.entries(cart).filter(([, q]) => q > 0).map(([k, q]) => (q > 1 ? q + "× " : "") + names[k]).join(", ");
    setMoney((m) => m - cartTotal);
    if (cartFoodAdd) addFood(cartFoodAdd);
    setParts((p) => ({ wheel: p.wheel + cartQty("wheel"), axle: p.axle + cartQty("axle"), tongue: p.tongue + cartQty("tongue") }));
    if (cartQty("ox")) setOxen((o) => o + cartQty("ox"));
    if (cartQty("tonic")) setTonics((t) => t + cartQty("tonic"));
    pushLog("Bought " + bought + " for $" + cartTotal + ".", "normal");
    sfx.good();
    setCart({});
  };
  const buyGear = (k) => {
    const g = GEAR[k];
    if (gear[k] || money < g.cost) return;
    setMoney((m) => m - g.cost);
    setGear((prev) => ({ ...prev, [k]: true }));
    pushLog("Bought a " + g.label.toLowerCase() + " for $" + g.cost + ". " + g.desc + ".", "good");
    sfx.coin();
  };

  const StoreCart = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {Object.entries(STORE_PRICES).filter(([, item]) => !item.postOnly || atStore).map(([k, item]) => {
        const q = cartQty(k);
        return (
          <div key={k} className="ww-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px" }}>
            <div className="mono" style={{ fontSize: 10 }}>{item.label}<span style={{ color: "#6e8474" }}> · ${"" + priceOf(k)}{item.part ? " · own " + parts[k] + "/" + PART_CAP : item.tonic ? " · own " + tonics + "/2" : ""}</span></div>
            <div className="ww-row" style={{ gap: 7 }}>
              <button className="ww-mini" style={{ padding: "2px 10px", fontSize: 13, lineHeight: 1.2 }} onClick={() => bump(k, -1)} disabled={q === 0}>−</button>
              <span className="mono" style={{ fontSize: 11, width: 14, textAlign: "center", fontWeight: q > 0 ? 700 : 400 }}>{q}</span>
              <button className="ww-mini" style={{ padding: "2px 10px", fontSize: 13, lineHeight: 1.2 }} onClick={() => bump(k, 1)}>+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
  const CheckoutBar = () => (
    <div style={{ marginTop: 6 }}>
      <div className="mono" style={{ fontSize: 10, color: "#3c5a47", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
        <span>Cart: <b>${"" + cartTotal}</b></span>
        <span>${"" + (money - cartTotal)} left after · food {Math.min(FOOD_CAP, food + cartFoodAdd)}/{FOOD_CAP}</span>
      </div>
      <button className="ww-btn" style={{ padding: 9 }} onClick={checkout} disabled={cartTotal <= 0}>
        Checkout — ${"" + cartTotal}
      </button>
    </div>
  );

  const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Courier+Prime:wght@400;700&display=swap');
.ww-app{height:100vh;height:100dvh;overflow:hidden;background:#e6e2cf;color:#22392b;display:flex;justify-content:center;padding:6px;box-sizing:border-box}
.ww-app *{box-sizing:border-box}
.ww-frame{position:relative;width:100%;max-width:560px;height:100%;background:#f6f3e4;border:1px solid #c3c6a8;border-radius:4px;box-shadow:0 2px 0 #c3c6a8;display:flex;flex-direction:column;overflow:hidden}
.ww-pad{padding:10px 12px;display:flex;flex-direction:column;flex:1;min-height:0}
.mono{font-family:'Courier Prime',monospace}
.serif{font-family:'Playfair Display',serif}
.ww-eyebrow{font-family:'Courier Prime',monospace;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#6e8474}
.ww-app button{font-family:'Courier Prime',monospace;cursor:pointer}
.ww-app button:disabled{opacity:.35;cursor:not-allowed}
.ww-btn{width:100%;padding:11px;background:#22392b;color:#f6f3e4;border:none;border-radius:3px;font-size:12px;text-transform:uppercase;letter-spacing:.15em}
.ww-btn:not(:disabled):active{background:#3f7a4e}
.ww-ghost{width:100%;padding:9px;background:transparent;color:#22392b;border:2px solid #22392b;border-radius:3px;font-size:11px;text-transform:uppercase;letter-spacing:.12em}
.ww-ghost:active{background:#e6e2cf}
.ww-mini{background:transparent;color:#6e8474;border:1px solid #c3c6a8;border-radius:3px;padding:5px 8px;font-size:9px;text-transform:uppercase;letter-spacing:.12em}
.ww-cardbtn{width:100%;text-align:left;border:2px solid #c3c6a8;background:transparent;border-radius:3px;padding:7px 8px;font-family:'Courier Prime',monospace;font-size:10px;color:#22392b;line-height:1.35}
.ww-cardbtn.sel{border-color:#3f7a4e;background:#22392b;color:#f6f3e4;box-shadow:0 2px 0 #3f7a4e}
.ww-cardbtn.dim{opacity:.4}
.ww-chip{font-size:8px;letter-spacing:.14em;text-transform:uppercase;background:#3f7a4e;color:#f6f3e4;padding:2px 5px;border-radius:2px;white-space:nowrap}
.ww-seg{flex:1;padding:8px 2px;border:2px solid #c3c6a8;background:transparent;border-radius:3px;font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#3c5a47}
.ww-seg.on{border-color:#3f7a4e;background:#22392b;color:#f6f3e4;font-weight:700}
.ww-panel{border:1px solid #c3c6a8;background:#ece9d6;border-radius:3px}
.ww-today{border:2px solid #22392b;background:#f6f3e4;box-shadow:0 2px 0 #c3c6a8;border-radius:3px;padding:6px 9px}
.ww-stat{border:1px solid #c3c6a8;background:#ece9d6;border-radius:3px;padding:4px 2px;display:flex;flex-direction:column;align-items:center;gap:1px;font-family:'Courier Prime',monospace;font-size:9px;text-align:center;line-height:1.25}
.ww-input{width:100%;background:transparent;border:none;border-bottom:2px solid #c3c6a8;font-family:'Courier Prime',monospace;font-size:16px;padding:6px 0;color:#22392b;outline:none}
.ww-input:focus{border-bottom-color:#3f7a4e}
.ww-overlay{position:absolute;inset:0;background:#f6f3e4;z-index:20;display:flex;flex-direction:column;padding:12px}
.ww-row{display:flex;gap:5px;align-items:center}
.ww-grid2{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.ww-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.ww-scroll{overflow-y:auto;min-height:0;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.ww-hr{height:1px;background:#c3c6a8;border:none;margin:8px 0}
`;

  const SelChip = ({ show, label }) => show ? <span className="ww-chip">{label || "Chosen"}</span> : null;

  return (
    <div className="ww-app">
      <style>{css}</style>
      <div className="ww-frame">

        {screen === "title" && (
          <div className="ww-pad" style={{ justifyContent: "center", textAlign: "center" }}>
            <div className="ww-eyebrow">A Traveler's Ledger</div>
            <h1 className="serif" style={{ fontSize: 44, fontWeight: 900, margin: "6px 0 2px" }}>WAGON WEST</h1>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "6px 0", opacity: .7 }}>
              <div style={{ height: 1, width: 60, background: "#3f7a4e" }} />
              <Compass size={15} color="#3f7a4e" />
              <div style={{ height: 1, width: 60, background: "#3f7a4e" }} />
            </div>
            <p className="mono" style={{ fontSize: 12, color: "#3c5a47", maxWidth: 380, margin: "10px auto 0", lineHeight: 1.6 }}>
              {TOTAL_MILES} miles of open country stand between your family and a new start.
              Ration wisely. Choose your pace. Not everyone who leaves Widow's Creek reaches Cutter's Valley.
            </p>
            <div style={{ marginTop: 24 }}>
              <button className="ww-btn" style={{ maxWidth: 280, margin: "0 auto", display: "block" }}
                onClick={() => { sfx.start(); setSetupStep(0); setScreen("setup"); }}>
                Begin the Journey
              </button>
              {hasSave && (
                <button className="ww-ghost" style={{ maxWidth: 280, margin: "10px auto 0", display: "block" }} onClick={resumeGame}>
                  Resume Your Journey
                </button>
              )}
            </div>
          </div>
        )}

        {screen === "setup" && (
          <div className="ww-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 className="serif" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
                {setupStep === 0 ? "The Ledger" : setupStep === 1 ? "The Season" : "The Party"}
              </h2>
              <span className="ww-eyebrow">{setupStep + 1} of 3</span>
            </div>

            {setupStep === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
                <div>
                  <div className="ww-eyebrow" style={{ marginBottom: 4 }}>Your Name</div>
                  <input className="ww-input" value={leaderName} onChange={(e) => setLeaderName(e.target.value)} placeholder="e.g. Marion Hale" />
                </div>
                <div>
                  <div className="ww-eyebrow" style={{ marginBottom: 5 }}>Your Trade</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {PROFESSIONS.map((p) => (
                      <button key={p.id} type="button"
                        className={"ww-cardbtn" + (profession === p.id ? " sel" : "")}
                        onClick={() => { setProfession(p.id); sfx.coin(); }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="serif" style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</span>
                          {profession === p.id ? <SelChip show label="Chosen" /> : <span style={{ color: "#6e8474" }}>${"" + p.money}</span>}
                        </div>
                        <div style={{ marginTop: 2, color: profession === p.id ? "#ccd7bf" : "#3c5a47" }}>${"" + p.money} · {p.note}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {setupStep === 1 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
                <div className="ww-eyebrow">Departure Window</div>
                {DEPARTURES.map((d) => (
                  <button key={d.id} type="button"
                    className={"ww-cardbtn" + (departure === d.id ? " sel" : "")}
                    onClick={() => { setDeparture(d.id); sfx.coin(); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="serif" style={{ fontSize: 13, fontWeight: 700 }}>{d.label}</span>
                      <SelChip show={departure === d.id} />
                    </div>
                    <div style={{ marginTop: 2, color: departure === d.id ? "#ccd7bf" : "#3c5a47" }}>{d.note}</div>
                  </button>
                ))}
                <p className="mono" style={{ fontSize: 10, color: "#6e8474", fontStyle: "italic", margin: "4px 0 0" }}>
                  The trail runs 150 to 210 days. Leave late or linger, and winter finds you in the passes.
                </p>
              </div>
            )}

            {setupStep === 2 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 6, paddingTop: 6 }}>
                <p className="mono" style={{ fontSize: 10, color: "#6e8474", fontStyle: "italic", margin: 0 }}>
                  Hired hands bring skills but take wages. Their gifts die with them. Choose 3.
                </p>
                <div className="ww-grid2 ww-scroll" style={{ flex: 1, alignContent: "start" }}>
                  {CANDIDATES.map((c) => {
                    const isPicked = picked.includes(c.id);
                    const blocked = picked.length >= 3 && !isPicked;
                    return (
                      <button key={c.id} type="button"
                        className={"ww-cardbtn" + (isPicked ? " sel" : blocked ? " dim" : "")}
                        onClick={() => {
                          if (isPicked) { setPicked((prev) => prev.filter((x) => x !== c.id)); sfx.coin(); }
                          else if (!blocked) { setPicked((prev) => [...prev, c.id]); sfx.coin(); }
                          else sfx.bad();
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="serif" style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</span>
                          {isPicked ? <SelChip show label="In Party" /> : <span style={{ color: "#6e8474", fontSize: 9 }}>{c.cost > 0 ? "$" + c.cost : "free"}</span>}
                        </div>
                        <div style={{ color: isPicked ? "#ccd7bf" : "#6e8474", fontSize: 9 }}>{c.role}{isPicked && c.cost > 0 ? " · $" + c.cost : ""}</div>
                        <div style={{ marginTop: 1, color: isPicked ? "#ccd7bf" : "#3c5a47", fontSize: 9 }}>{c.desc}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="ww-panel mono" style={{ padding: "7px 9px", fontSize: 10, borderColor: wages > profNow.money ? "#a8462f" : "#c3c6a8" }}>
                  <b>{picked.length}/3</b> · Stake ${"" + profNow.money} − wages ${"" + wages} = <b style={{ color: wages > profNow.money ? "#a8462f" : "#22392b" }}>${"" + (profNow.money - wages)} to depart</b>
                  {wages > profNow.money && <span style={{ color: "#a8462f", fontWeight: 700 }}> — can't afford this crew</span>}
                </div>
              </div>
            )}

            <div className="ww-row" style={{ marginTop: 10 }}>
              <button className="ww-ghost" style={{ flex: 1 }}
                onClick={() => { setupStep === 0 ? setScreen("title") : setSetupStep(setupStep - 1); }}>
                Back
              </button>
              {setupStep < 2 ? (
                <button className="ww-btn" style={{ flex: 2 }} onClick={() => { sfx.coin(); setSetupStep(setupStep + 1); }}>
                  Next
                </button>
              ) : (
                <button className="ww-btn" style={{ flex: 2 }} disabled={picked.length !== 3 || wages > profNow.money} onClick={prepareJourney}>
                  Load the Wagon
                </button>
              )}
            </div>
          </div>
        )}

        {screen === "outfit" && (
          <div className="ww-pad">
            <h2 className="serif" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Outfitting at Widow's Creek</h2>
            <p className="mono" style={{ fontSize: 10, color: "#6e8474", margin: "2px 0 8px" }}>Spend now or gamble on the posts. Prices only climb out west.</p>
            <div className="ww-panel mono ww-grid2" style={{ padding: 8, fontSize: 10, marginBottom: 8 }}>
              <span>Cash: <b>${"" + money}</b></span>
              <span>Food: <b>{food}/{FOOD_CAP} lbs</b></span>
              <span>Spares: <b>{parts.wheel}/{parts.axle}/{parts.tongue}</b></span>
              <span>Oxen: <b>{oxen}</b></span>
            </div>
            <StoreCart />
            <CheckoutBar />
            <p className="mono" style={{ fontSize: 9, color: "#6e8474", fontStyle: "italic" }}>
              12 lbs feeds four for a day on filling rations. The trail runs 150 to 210 days.
            </p>
            <div style={{ marginTop: "auto" }}>
              {food <= 0 && <p className="mono" style={{ fontSize: 9, color: "#a8462f", margin: "0 0 5px", fontWeight: 700 }}>The wagon leaves empty. Buy provisions before the trail — an empty larder won't cross the first county.</p>}
              <button className="ww-btn" onClick={departJourney} disabled={food <= 0}>Depart for the West</button>
              <button className="ww-mini" style={{ width: "100%", marginTop: 6, border: "none" }} onClick={handleResetTap}>
                {resetArmed ? "Tap again to confirm — wipes the run" : "Start over"}
              </button>
            </div>
          </div>
        )}

        {screen === "travel" && (
          <div className="ww-pad" style={{ gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div className="ww-eyebrow">
                  Day {day} · {dateLabel(doy)} · <span style={{ color: season === "winter" ? "#4a6a8a" : season === "fall" ? "#a8462f" : "#6e8474", fontWeight: season === "winter" ? 700 : 400 }}>{seasonCfg.label}</span>
                </div>
                <div className="serif" style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Near {lastLandmark.name}
                </div>
              </div>
              <div className="mono" style={{ textAlign: "right", fontSize: 9, color: "#6e8474", flexShrink: 0, marginLeft: 8 }}>
                <div className="ww-row" style={{ justifyContent: "flex-end", gap: 4 }}>
                  <button className="ww-mini" style={{ padding: 4, background: resetArmed ? "#a8462f" : "transparent", color: resetArmed ? "#f6f3e4" : "#6e8474", borderColor: resetArmed ? "#a8462f" : "#c3c6a8" }} onClick={handleResetTap} aria-label="Start over">
                    <RotateCcw size={11} />
                  </button>
                  <button className="ww-mini" style={{ padding: 4, color: linkCopied ? "#33663f" : "#6e8474", borderColor: linkCopied ? "#3f7a4e" : "#c3c6a8" }} onClick={copySaveLink} aria-label="Copy save link">
                    {linkCopied ? <Check size={11} /> : <Link2 size={11} />}
                  </button>
                  <button className="ww-mini" style={{ padding: 4 }} onClick={() => setSoundOn((s) => !s)} aria-label="Sound">
                    {soundOn ? <Volume2 size={11} /> : <VolumeX size={11} />}
                  </button>
                  <span>{Math.round(miles)}/{TOTAL_MILES} mi</span>
                </div>
                {resetArmed && <div style={{ color: "#a8462f", marginTop: 2 }}>Tap again to wipe run</div>}
                {linkCopied && <div style={{ color: "#33663f", marginTop: 2 }}>Save link copied</div>}
                <div style={{ marginTop: 2 }}>→ {nextLandmark.name.split(" (")[0]} ({Math.max(0, nextLandmark.miles - Math.round(miles))} mi)</div>
              </div>
            </div>

            <TrailMap miles={miles} total={TOTAL_MILES} />

            {todays.length > 0 && (
              <div className="ww-today">
                <div className="ww-eyebrow" style={{ fontSize: 8, marginBottom: 2 }}>What happened</div>
                {todays.map((e) => (
                  <p key={e.id} className="mono" style={{ fontSize: 11, lineHeight: 1.4, margin: 0, color: logColor(e.kind), fontWeight: e.kind === "bad" || e.kind === "good" || e.kind === "landmark" ? 700 : 400 }}>{e.text}</p>
                ))}
              </div>
            )}

            <div className="ww-grid4">
              {members.map((m, i) => {
                const dead = m.health <= 0;
                const st = statusFor(m.health);
                return (
                  <div key={i} className="ww-panel" style={{ padding: "4px 6px", opacity: dead ? .5 : 1 }}>
                    <div className="mono" style={{ fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: dead ? "line-through" : "none", color: dead ? "#6e8474" : "#22392b" }}>{m.name.split(" ")[0]}</div>
                    <div style={{ height: 4, background: "#ccd7bf", borderRadius: 2, overflow: "hidden", margin: "2px 0" }}>
                      {!dead && <div style={{ height: "100%", width: m.health + "%", background: barColor(m.health), transition: "width .3s" }} />}
                    </div>
                    <div className="mono" style={{ fontSize: 8, color: dead ? "#6e8474" : st.c }}>{dead ? "Gone" : st.t}</div>
                  </div>
                );
              })}
            </div>

            {river ? (
              <div className="ww-panel" style={{ padding: 9, flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <div className="ww-eyebrow"><Droplet size={10} style={{ verticalAlign: "-1px" }} /> River Crossing — {river.depth} ft deep</div>
                <p className="mono" style={{ fontSize: 10, color: "#3c5a47", margin: 0 }}>
                  {river.depth <= 3 ? "Shallow enough to ford, most likely." : "Deep water. Fording would be a gamble."}
                </p>
                <button className="ww-cardbtn" onClick={() => resolveRiver("ferry")} disabled={money < 10 + river.depth * 4}>Pay the ferryman — ${"" + (10 + river.depth * 4)}, safe passage</button>
                {gold >= 0.1 && (
                  <button className="ww-cardbtn" style={{ borderColor: "#c9a227" }} onClick={() => resolveRiver("ferryGold")} disabled={gold < Math.ceil(((10 + river.depth * 4) / 14) * 10) / 10}>
                    Pay in gold dust — {Math.ceil(((10 + river.depth * 4) / 14) * 10) / 10} oz, his rate, safe passage
                  </button>
                )}
                <button className="ww-cardbtn" onClick={() => resolveRiver("float")}>Caulk and float — free, small leak risk</button>
                <button className="ww-cardbtn" onClick={() => resolveRiver("ford")}>Ford the river — free, risky in deep water</button>
              </div>
            ) : hunt ? (
              <div className="ww-panel" style={{ padding: 9, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
                <div className="ww-eyebrow">Steady... fire when the mark is centered</div>
                <div style={{ position: "relative", height: 26, background: "#ccd7bf", border: "1px solid #c3c6a8", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: 34, background: "rgba(107,122,94,.35)", borderLeft: "1px solid #4c7d58", borderRight: "1px solid #4c7d58" }} />
                  <div style={{ position: "absolute", top: 0, bottom: 0, width: 6, background: "#3f7a4e", left: hunt.pos + "%" }} />
                </div>
                <div className="ww-row">
                  <button className="ww-btn" style={{ flex: 2, background: "#3f7a4e" }} onClick={fireShot}>Fire</button>
                  <button className="ww-ghost" style={{ flex: 1 }} onClick={() => { setHunt(null); pushLog("The party lowers the rifle and lets the game pass.", "normal"); }}>Withdraw</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 5 }}>
                <div className="ww-row">
                  <span className="ww-eyebrow" style={{ width: 52, flexShrink: 0, fontSize: 8 }}>Pace</span>
                  {Object.entries(PACES).map(([k, v]) => (
                    <button key={k} className={"ww-seg" + (pace === k ? " on" : "")} onClick={() => { if (pace !== k) { setPace(k); sfx.coin(); } }}>{v.label}</button>
                  ))}
                </div>
                <div className="ww-row">
                  <span className="ww-eyebrow" style={{ width: 52, flexShrink: 0, fontSize: 8 }}>Rations</span>
                  {Object.entries(RATIONS).map(([k, v]) => (
                    <button key={k} className={"ww-seg" + (rations === k ? " on" : "")} onClick={() => { if (rations !== k) { setRations(k); sfx.coin(); } }}>{v.label}</button>
                  ))}
                </div>
                <div className="ww-grid2" style={{ marginTop: 2 }}>
                  <button className="ww-btn" style={{ padding: 10 }} onClick={travelOneDay} disabled={!!ending}>Travel</button>
                  <button className="ww-ghost" style={{ padding: 9 }} onClick={startHunt} disabled={!!ending}><Crosshair size={11} style={{ verticalAlign: "-1px" }} /> Hunt</button>
                  <button className="ww-ghost" style={{ padding: 9 }} onClick={panForGold} disabled={!!ending}><Coins size={11} style={{ verticalAlign: "-1px" }} /> Pan</button>
                  <button className="ww-ghost" style={{ padding: 9 }} onClick={restOneDay} disabled={!!ending}><Tent size={11} style={{ verticalAlign: "-1px" }} /> Rest</button>
                </div>
                <button className="ww-mini" style={{ width: "100%", borderStyle: "dashed" }} onClick={waitForSeason} disabled={!!ending}>
                  Camp until {nextSeasonName()} (~{daysUntilNextSeason()}d, {dailyFood() * daysUntilNextSeason()} lbs)
                </button>
                {canReenter && (
                  <button className="ww-mini" style={{ width: "100%", borderColor: "#c9a227" }} onClick={() => { setCart({}); setAtStore(true); }}>
                    Walk back to the trading post
                  </button>
                )}
              </div>
            )}

            <div className="ww-grid4">
              <div className="ww-stat"><Wheat size={11} color="#4c7d58" /><span>{Math.round(food)}/{FOOD_CAP}<br />~{foodDays}d</span></div>
              <div className="ww-stat"><Coins size={11} color="#c9a227" /><span>${"" + money}<br />{gold >= 0.1 ? gold + " oz" : "—"}</span></div>
              <div className="ww-stat"><Wrench size={11} color="#3c5a47" /><span>{parts.wheel}/{parts.axle}/{parts.tongue}<br />{oxen} ox{tonics > 0 ? " · " + tonics + "⚕" : ""}</span></div>
              <button className="ww-stat" style={{ borderColor: "#6e8474" }} onClick={() => setShowJournal(true)}>
                <BookOpen size={11} color="#6e8474" /><span>Journal<br />day {day}</span>
              </button>
            </div>
          </div>
        )}

        {screen === "end" && ending && (
          <div className="ww-pad" style={{ justifyContent: "center", textAlign: "center" }}>
            {ending.type === "win" ? <Flag size={36} color="#4c7d58" style={{ margin: "0 auto 8px" }} /> : <Skull size={36} color="#a8462f" style={{ margin: "0 auto 8px" }} />}
            <h2 className="serif" style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>
              {ending.type === "win" ? "Cutter's Valley" : "The Trail Ends Here"}
            </h2>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "8px 0", opacity: .7 }}>
              <div style={{ height: 1, width: 60, background: "#3f7a4e" }} />
              <Compass size={14} color="#3f7a4e" />
              <div style={{ height: 1, width: 60, background: "#3f7a4e" }} />
            </div>
            {ending.type === "win" ? (
              <div className="mono" style={{ fontSize: 12, color: "#3c5a47", lineHeight: 1.7 }}>
                <p style={{ margin: 0 }}>{ending.days} days on the trail. {ending.survivors} of 4 souls made it.</p>
                <p style={{ margin: 0 }}>${"" + ending.moneyLeft} left in the strongbox.</p>
                <p style={{ margin: "10px 0 0", fontStyle: "italic" }}>
                  {ending.survivors === 4 ? "A clean journey. Rare, and worth telling." : ending.survivors >= 2 ? "The valley is green. The cost was real." : "You arrive alone, or nearly so. It is still arriving."}
                </p>
              </div>
            ) : (
              <div className="mono" style={{ fontSize: 12, color: "#3c5a47", lineHeight: 1.7 }}>
                <p style={{ margin: 0 }}>{ending.cause === "plague"
                  ? "Day " + ending.days + ". Cholera came to the camp in the night, and there was no medicine. None were spared."
                  : ending.cause === "oxen"
                  ? "Day " + ending.days + ". The last ox is gone, and the wagon will not move again — " + Math.round((miles / TOTAL_MILES) * 100) + "% of the way to Cutter's Valley."
                  : "Day " + ending.days + ". " + Math.round((miles / TOTAL_MILES) * 100) + "% of the way to Cutter's Valley."}</p>
                <p style={{ margin: "10px 0 0", fontStyle: "italic" }}>"{ending.epitaph}"</p>
              </div>
            )}
            <button className="ww-btn" style={{ maxWidth: 280, margin: "22px auto 0", display: "block" }} onClick={restart}>
              Start a New Ledger
            </button>
          </div>
        )}

        {atStore && screen === "travel" && (
          <div className="ww-overlay">
            <div style={{ marginBottom: 8 }}>
              <h2 className="serif" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Trading Post</h2>
              <div className="ww-eyebrow" style={{ marginTop: 2 }}>${"" + money} on hand{season === "winter" ? " · winter prices" : ""} · food {food}/{FOOD_CAP} lbs</div>
            </div>
            <div className="ww-scroll" style={{ flex: 1, WebkitOverflowScrolling: "touch" }}>
              <StoreCart />
              {gold >= 0.1 && (
                <button className="ww-cardbtn" style={{ borderColor: "#c9a227", marginTop: 4 }} onClick={sellGold}>
                  Sell gold ({gold} oz) — ${"" + Math.round(gold * GOLD_PRICE)}
                </button>
              )}
              {lastLandmark.miles >= 1300 && Object.keys(GEAR).some((k) => !gear[k]) && (
                <div style={{ marginTop: 8 }}>
                  <div className="ww-eyebrow" style={{ marginBottom: 4 }}>Rare Goods — one of each, this far west</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {Object.entries(GEAR).filter(([k]) => !gear[k]).map(([k, g]) => (
                      <button key={k} className="ww-cardbtn" onClick={() => buyGear(k)} disabled={money < g.cost}>
                        {g.label} — ${"" + g.cost} · {g.desc}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <CheckoutBar />
            <button className="ww-ghost" style={{ marginTop: 6, padding: 9 }} onClick={() => { setAtStore(false); setCanReenter(true); setCart({}); }}>Leave the Post</button>
          </div>
        )}

        {showJournal && screen === "travel" && (
          <div className="ww-overlay">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="ww-eyebrow" style={{ fontSize: 11 }}><BookOpen size={12} style={{ verticalAlign: "-2px" }} /> Journal</div>
              <button className="ww-mini" onClick={() => setShowJournal(false)}>Close</button>
            </div>
            <div className="ww-panel ww-scroll" style={{ flex: 1, padding: 10 }}>
              {log.map((entry) => (
                <p key={entry.id} className="mono" style={{ fontSize: 11, lineHeight: 1.5, margin: "0 0 5px", color: logColor(entry.kind), fontWeight: entry.kind === "landmark" ? 700 : 400 }}>
                  <span style={{ opacity: .6 }}>Day {entry.day} — </span>{entry.text}
                </p>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
