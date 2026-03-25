import { useState, useEffect, useRef, useCallback } from "react";

// ── JSON Configuration ──────────────────────────────────────────────
const PLATE_DEFS = [
  { weight: 25,  widthPx: 48, color: "#DC2626", label: "25",  textColor: "#fff",    heightRatio: 1,   border: null },
  { weight: 20,  widthPx: 40, color: "#2563EB", label: "20",  textColor: "#fff",    heightRatio: 1,   border: null },
  { weight: 15,  widthPx: 32, color: "#EAB308", label: "15",  textColor: "#1a1a1a", heightRatio: 1,   border: null },
  { weight: 10,  widthPx: 26, color: "#16A34A", label: "10",  textColor: "#fff",    heightRatio: 1,   border: null },
  { weight: 5,   widthPx: 18, color: "#9CA3AF", label: "5",   textColor: "#1a1a1a", heightRatio: 1,   border: null },
  { weight: 2.5, widthPx: 18, color: "#1a1a1a", label: "2.5", textColor: "#d4d4d8", heightRatio: 0.5, border: "#71717a" },
];

const DEFAULTS = {
  barWeight: 20,
  totalRounds: 10,
  maxPlates: 6,
  maxTotalWeight: 220,
  enabledWeights: [25, 20, 15, 10, 5, 2.5],
};

const CORRECT_DELAY = 700;

// ── Cookie helpers ──────────────────────────────────────────────────
function saveCookie(key, val) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  document.cookie = `${key}=${encodeURIComponent(JSON.stringify(val))};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}
function loadCookie(key) {
  const m = document.cookie.split("; ").find((r) => r.startsWith(key + "="));
  if (!m) return null;
  try {
    return JSON.parse(decodeURIComponent(m.split("=").slice(1).join("=")));
  } catch {
    return null;
  }
}

function loadSettings() {
  const saved = loadCookie("platemath_settings");
  if (!saved) return { ...DEFAULTS };
  return {
    barWeight: [15, 20].includes(saved.barWeight) ? saved.barWeight : DEFAULTS.barWeight,
    totalRounds: DEFAULTS.totalRounds,
    maxPlates: Math.min(7, Math.max(3, saved.maxPlates ?? DEFAULTS.maxPlates)),
    maxTotalWeight: Math.min(300, Math.max(100, saved.maxTotalWeight ?? DEFAULTS.maxTotalWeight)),
    enabledWeights: Array.isArray(saved.enabledWeights)
      ? saved.enabledWeights.filter((w) => PLATE_DEFS.some((p) => p.weight === w))
      : DEFAULTS.enabledWeights,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────
function generateRound(settings) {
  const available = PLATE_DEFS.filter((p) => settings.enabledWeights.includes(p.weight));
  if (available.length === 0) return { plates: [], total: settings.barWeight };
  const maxSide = (settings.maxTotalWeight - settings.barWeight) / 2;
  const count = Math.floor(Math.random() * settings.maxPlates) + 1;
  let chosen = [];
  let sideW = 0;
  for (let i = 0; i < count; i++) {
    const fits = available.filter((p) => sideW + p.weight <= maxSide);
    if (fits.length === 0) break;
    const pick = fits[Math.floor(Math.random() * fits.length)];
    chosen.push(pick);
    sideW += pick.weight;
  }
  if (chosen.length === 0) {
    const lightest = [...available].sort((a, b) => a.weight - b.weight)[0];
    if (lightest && lightest.weight <= maxSide) {
      chosen = [lightest];
      sideW = lightest.weight;
    }
  }
  chosen.sort((a, b) => b.weight - a.weight);
  const total = settings.barWeight + 2 * sideW;
  return { plates: chosen, total };
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function niceWeight(n) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ── Barbell SVG ─────────────────────────────────────────────────────
function BarbellView({ plates, shake }) {
  const fullH = 140;
  const sleeveH = 16;
  const hubW = 28;
  const hubH = 52;
  const collarW = 12;
  const totalPW = plates.reduce((s, p) => s + p.widthPx + 2, 0);
  const svgW = Math.max(300, hubW + collarW + totalPW + 60);
  const svgH = fullH + 60;
  const bY = 80;
  let cx = 10;

  return (
    <div
      className={`flex justify-center w-full overflow-hidden ${shake ? "animate-shake" : ""}`}
      style={{ minHeight: svgH + 10 }}
    >
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: svgW }}
      >
        {/* Sleeve */}
        <rect x={cx} y={bY + (fullH - sleeveH) / 2} width={svgW - cx - 20} height={sleeveH} rx={3} fill="#71717a" />
        {/* Hub */}
        <rect x={cx} y={bY + (fullH - hubH) / 2} width={hubW} height={hubH} rx={4} fill="#a1a1aa" stroke="#52525b" strokeWidth={1.5} />
        {(cx += hubW, null)}
        {/* Collar */}
        <rect x={cx} y={bY + (fullH - 30) / 2} width={collarW} height={30} rx={2} fill="#a1a1aa" />
        {(cx += collarW + 3, null)}
        {/* Plates */}
        {plates.map((plate, i) => {
          const px = cx;
          cx += plate.widthPx + 2;
          const pH = fullH * plate.heightRatio;
          const py = bY + (fullH - pH) / 2;
          return (
            <g key={i}>
              <rect x={px + 2} y={py + 3} width={plate.widthPx} height={pH} rx={5} fill="rgba(0,0,0,0.18)" />
              <rect
                x={px} y={py} width={plate.widthPx} height={pH} rx={5}
                fill={plate.color}
                stroke={plate.border || "none"}
                strokeWidth={plate.border ? 1.5 : 0}
              />
              <rect x={px + 3} y={py + 8} width={Math.max(plate.widthPx - 6, 4)} height={pH - 16} rx={3} fill="rgba(255,255,255,0.10)" />
              {plate.widthPx >= 18 && (
                <text
                  x={px + plate.widthPx / 2} y={py + pH / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fill={plate.textColor}
                  fontSize={plate.heightRatio < 1 ? 9 : plate.widthPx >= 32 ? 13 : 10}
                  fontWeight="800" fontFamily="'DM Mono', monospace"
                  style={{ userSelect: "none" }}
                >
                  {plate.label}
                </text>
              )}
            </g>
          );
        })}
        {/* End cap */}
        <rect x={cx + 2} y={bY + (fullH - 24) / 2} width={8} height={24} rx={2} fill="#a1a1aa" />
      </svg>
    </div>
  );
}

// ── Toggle ──────────────────────────────────────────────────────────
function Toggle({ on, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        width: 44, height: 26, borderRadius: 13, border: "none", padding: 2,
        background: on ? "#16A34A" : "#3f3f46",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.2s",
        display: "flex", alignItems: "center",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        style={{
          width: 22, height: 22, borderRadius: 11, background: "#f4f4f5",
          transform: on ? "translateX(18px)" : "translateX(0)",
          transition: "transform 0.2s",
        }}
      />
    </button>
  );
}

// ── Stepper ─────────────────────────────────────────────────────────
function Stepper({ value, onChange, min, max, step = 1, format }) {
  const display = format ? format(value) : value;
  const btnStyle = (disabled) => ({
    width: 36, height: 36, borderRadius: 10, border: "none",
    background: "#27272a", color: disabled ? "#3f3f46" : "#f4f4f5",
    fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace",
    cursor: disabled ? "default" : "pointer",
    WebkitTapHighlightColor: "transparent",
  });
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} style={btnStyle(value <= min)}>−</button>
      <span style={{ minWidth: 64, textAlign: "center", fontSize: 16, fontWeight: 700, color: "#f4f4f5", fontFamily: "'DM Mono', monospace" }}>
        {display}
      </span>
      <button onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} style={btnStyle(value >= max)}>+</button>
    </div>
  );
}

// ── Settings Panel ──────────────────────────────────────────────────
function SettingsPanel({ settings, onChange }) {
  const { barWeight, maxPlates, maxTotalWeight, enabledWeights } = settings;

  const toggleWeight = (w) => {
    const on = enabledWeights.includes(w);
    const next = on ? enabledWeights.filter((x) => x !== w) : [...enabledWeights, w];
    if (next.length === 0) return; // prevent all off
    onChange({ ...settings, enabledWeights: next });
  };

  const secLabel = {
    fontSize: 11, color: "#71717a", fontFamily: "'DM Mono', monospace",
    letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
  };
  const card = { background: "#18181b", borderRadius: 14, padding: "6px 14px" };
  const row = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0" };

  const onlyOne = enabledWeights.length === 1;

  return (
    <div className="w-full max-w-xs flex flex-col gap-5" style={{ marginTop: 4 }}>
      {/* Plates */}
      <div>
        <div style={secLabel}>Plates</div>
        <div style={card}>
          {PLATE_DEFS.map((p, idx) => (
            <div
              key={p.weight}
              style={{
                ...row,
                borderBottom: idx < PLATE_DEFS.length - 1 ? "1px solid #222" : "none",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  style={{
                    display: "inline-block", width: 28,
                    height: p.heightRatio < 1 ? 12 : 20,
                    borderRadius: 4, background: p.color,
                    border: p.border ? `1.5px solid ${p.border}` : "none",
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d8", fontFamily: "'DM Mono', monospace" }}>
                  {niceWeight(p.weight)} kg
                </span>
              </div>
              <Toggle
                on={enabledWeights.includes(p.weight)}
                onToggle={() => toggleWeight(p.weight)}
                disabled={onlyOne && enabledWeights.includes(p.weight)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bar weight */}
      <div>
        <div style={secLabel}>Bar weight</div>
        <div style={{ ...card, padding: "12px 14px" }} className="flex gap-2">
          {[15, 20].map((w) => (
            <button
              key={w}
              onClick={() => onChange({ ...settings, barWeight: w })}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 10, border: "none",
                background: barWeight === w ? "#DC2626" : "#27272a",
                color: "#f4f4f5", fontWeight: 700, fontSize: 15,
                fontFamily: "'DM Mono', monospace", cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                transition: "background 0.15s",
              }}
            >
              {w} kg
            </button>
          ))}
        </div>
      </div>

      {/* Max plates */}
      <div>
        <div style={secLabel}>Max plates per side</div>
        <div style={{ ...card, padding: "10px 14px" }} className="flex justify-center">
          <Stepper value={maxPlates} onChange={(v) => onChange({ ...settings, maxPlates: v })} min={3} max={7} format={(v) => v} />
        </div>
      </div>

      {/* Max total weight */}
      <div>
        <div style={secLabel}>Max total weight</div>
        <div style={{ ...card, padding: "10px 14px" }} className="flex justify-center">
          <Stepper
            value={maxTotalWeight}
            onChange={(v) => onChange({ ...settings, maxTotalWeight: v })}
            min={100} max={300} step={10}
            format={(v) => `${v} kg`}
          />
        </div>
      </div>
    </div>
  );
}

// ── Start Screen ────────────────────────────────────────────────────
function StartScreen({ onStart, bestTime, settings, onSettingsChange }) {
  const [open, setOpen] = useState(false);
  const ok = settings.enabledWeights.length > 0;

  return (
    <div className="flex flex-col items-center gap-5 px-5 py-8 min-h-screen">
      {/* ── Barbell Logo ── */}
      <div style={{ marginTop: 20, width: "100%", maxWidth: 340 }}>
        <svg viewBox="0 0 340 100" width="100%" xmlns="http://www.w3.org/2000/svg">
          {/* Bar through the middle */}
          <rect x="12" y="44" width="316" height="12" rx="3" fill="#71717a" />

          {/* Left side — plates (lightest outermost, heaviest near center) */}
          <rect x="4" y="40" width="6" height="20" rx="2" fill="#a1a1aa" />
          <rect x="13" y="14" width="6" height="72" rx="3" fill="#9CA3AF" />
          <rect x="21" y="14" width="8" height="72" rx="4" fill="#16A34A" />
          <rect x="31" y="14" width="10" height="72" rx="4" fill="#2563EB" />
          <rect x="33" y="20" width="6" height="60" rx="3" fill="rgba(255,255,255,0.10)" />
          <rect x="43" y="14" width="12" height="72" rx="4" fill="#DC2626" />
          <rect x="45" y="20" width="8" height="60" rx="3" fill="rgba(255,255,255,0.10)" />
          <rect x="57" y="35" width="8" height="30" rx="2" fill="#a1a1aa" />
          <rect x="65" y="28" width="14" height="44" rx="3" fill="#a1a1aa" stroke="#52525b" strokeWidth="1" />

          {/* Dark backing behind text */}
          <rect x="108" y="8" width="124" height="84" rx="6" fill="#09090b" />
          {/* Center text */}
          <text x="170" y="40" textAnchor="middle" dominantBaseline="central"
            fontFamily="'Bebas Neue', sans-serif" fontSize="38" letterSpacing="4" fill="#f4f4f5">
            PLATE
          </text>
          <text x="170" y="72" textAnchor="middle" dominantBaseline="central"
            fontFamily="'Bebas Neue', sans-serif" fontSize="38" letterSpacing="4" fill="#f4f4f5">
            CALC
          </text>

          {/* Right side — mirrored (heaviest near center, lightest outermost) */}
          <rect x="261" y="28" width="14" height="44" rx="3" fill="#a1a1aa" stroke="#52525b" strokeWidth="1" />
          <rect x="275" y="35" width="8" height="30" rx="2" fill="#a1a1aa" />
          <rect x="285" y="14" width="12" height="72" rx="4" fill="#DC2626" />
          <rect x="287" y="20" width="8" height="60" rx="3" fill="rgba(255,255,255,0.10)" />
          <rect x="299" y="14" width="10" height="72" rx="4" fill="#2563EB" />
          <rect x="301" y="20" width="6" height="60" rx="3" fill="rgba(255,255,255,0.10)" />
          <rect x="311" y="14" width="8" height="72" rx="4" fill="#16A34A" />
          <rect x="321" y="14" width="6" height="72" rx="3" fill="#9CA3AF" />
          <rect x="330" y="40" width="6" height="20" rx="2" fill="#a1a1aa" />
        </svg>
      </div>
      <p
        style={{
          color: "#a1a1aa", fontSize: 13, maxWidth: 280, lineHeight: 1.6,
          fontFamily: "'DM Mono', monospace", textAlign: "center",
        }}
      >
        Calculate the total barbell weight from the plates shown. 10 rounds — go fast!
      </p>

      {/* Quick summary chips */}
      <div className="flex flex-wrap gap-2 justify-center" style={{ maxWidth: 300 }}>
        <span style={chipStyle}>{settings.barWeight}kg bar</span>
        <span style={chipStyle}>≤{settings.maxPlates} plates</span>
        <span style={chipStyle}>≤{settings.maxTotalWeight}kg</span>
      </div>

      {bestTime !== null && (
        <div style={{ color: "#EAB308", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600 }}>
          Best: {formatTime(bestTime)}
        </div>
      )}

      <button
        onClick={onStart} disabled={!ok}
        className="active:scale-95 transition-transform"
        style={{
          padding: "16px 52px", borderRadius: 16, border: "none",
          background: ok ? "#DC2626" : "#3f3f46", color: "#fff",
          fontSize: 22, fontWeight: 800, fontFamily: "'Bebas Neue', sans-serif",
          letterSpacing: 3, cursor: ok ? "pointer" : "default",
          opacity: ok ? 1 : 0.5, WebkitTapHighlightColor: "transparent",
        }}
      >
        START
      </button>

      {/* Settings toggle */}
      <button
        onClick={() => setOpen((s) => !s)}
        style={{
          background: "none", border: "none", color: open ? "#d4d4d8" : "#71717a",
          fontSize: 13, fontFamily: "'DM Mono', monospace", cursor: "pointer",
          padding: "4px 8px", WebkitTapHighlightColor: "transparent",
          display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        {open ? "Hide settings" : "Settings"}
      </button>

      {open && <SettingsPanel settings={settings} onChange={onSettingsChange} />}
    </div>
  );
}

const chipStyle = {
  fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace",
  color: "#a1a1aa", background: "#18181b", border: "1px solid #27272a",
  padding: "3px 10px", borderRadius: 8,
};

// ── Results Screen ──────────────────────────────────────────────────
function ResultsScreen({ rounds, totalTime, bestTime, onRestart, onHome }) {
  const isNewBest = bestTime === totalTime;
  return (
    <div className="flex flex-col items-center gap-5 px-4 py-8 min-h-screen">
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: "#f4f4f5", letterSpacing: 2 }}>
        RESULTS
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace", fontSize: 44, fontWeight: 700,
          color: isNewBest ? "#EAB308" : "#f4f4f5",
        }}
      >
        {formatTime(totalTime)}
      </div>
      {isNewBest && (
        <div style={{ color: "#EAB308", fontSize: 14, fontFamily: "'DM Mono', monospace", marginTop: -8, fontWeight: 600 }}>
          New best!
        </div>
      )}

      {/* Round breakdown */}
      <div className="w-full max-w-xs flex flex-col gap-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
        <div className="flex justify-between px-2" style={{ color: "#52525b", fontSize: 11, marginBottom: 4 }}>
          <span style={{ width: 50 }}>ROUND</span>
          <span style={{ width: 44, textAlign: "center" }}>TRIES</span>
          <span style={{ width: 74, textAlign: "right" }}>TIME</span>
        </div>
        {rounds.map((r, i) => (
          <div
            key={i}
            className="flex justify-between px-3 py-2"
            style={{
              background: i % 2 === 0 ? "#141416" : "transparent",
              borderRadius: 8, color: "#d4d4d8",
            }}
          >
            <span style={{ width: 50 }}>#{i + 1}</span>
            <span style={{ width: 44, textAlign: "center", color: r.attempts > 1 ? "#DC2626" : "#16A34A" }}>
              {r.attempts}
            </span>
            <span style={{ width: 74, textAlign: "right" }}>{formatTime(r.time)}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-2">
        <button
          onClick={onHome}
          className="active:scale-95 transition-transform"
          style={{
            padding: "14px 28px", borderRadius: 14,
            border: "1.5px solid #3f3f46", background: "transparent",
            color: "#a1a1aa", fontSize: 16, fontWeight: 800,
            fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2,
            cursor: "pointer", WebkitTapHighlightColor: "transparent",
          }}
        >
          MENU
        </button>
        <button
          onClick={onRestart}
          className="active:scale-95 transition-transform"
          style={{
            padding: "14px 28px", borderRadius: 14, border: "none",
            background: "#DC2626", color: "#fff", fontSize: 16, fontWeight: 800,
            fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2,
            cursor: "pointer", WebkitTapHighlightColor: "transparent",
          }}
        >
          AGAIN
        </button>
      </div>
    </div>
  );
}

// ── Main Game ────────────────────────────────────────────────────────
export default function PlateMath() {
  const [settings, setSettingsRaw] = useState(loadSettings);
  const [screen, setScreen] = useState("start");
  const [round, setRound] = useState(0);
  const [roundData, setRoundData] = useState(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(1);
  const [roundResults, setRoundResults] = useState([]);
  const [gameStart, setGameStart] = useState(0);
  const [roundStart, setRoundStart] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [bestTime, setBestTime] = useState(() => loadCookie("platemath_best"));
  const [totalTime, setTotalTime] = useState(0);
  const timerRef = useRef(null);

  const setSettings = useCallback((s) => {
    setSettingsRaw(s);
    saveCookie("platemath_settings", s);
  }, []);

  const startTimer = useCallback(() => {
    const now = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - now), 37);
    return now;
  }, []);

  const stopTimer = useCallback(() => clearInterval(timerRef.current), []);

  const goHome = useCallback(() => {
    stopTimer();
    setScreen("start");
  }, [stopTimer]);

  const startGame = useCallback(() => {
    const rd = generateRound(settings);
    setRound(1);
    setRoundData(rd);
    setInput("");
    setFeedback(null);
    setAttempts(1);
    setRoundResults([]);
    setScreen("play");
    const now = startTimer();
    setGameStart(now);
    setRoundStart(now);
  }, [settings, startTimer]);

  const nextRound = useCallback(() => {
    if (round >= settings.totalRounds) {
      stopTimer();
      const total = Date.now() - gameStart;
      setTotalTime(total);
      const newBest = bestTime === null ? total : Math.min(bestTime, total);
      setBestTime(newBest);
      saveCookie("platemath_best", newBest);
      setScreen("results");
      return;
    }
    const rd = generateRound(settings);
    setRound((r) => r + 1);
    setRoundData(rd);
    setInput("");
    setFeedback(null);
    setAttempts(1);
    setRoundStart(Date.now());
  }, [round, settings, gameStart, bestTime, stopTimer]);

  const handleDigit = useCallback(
    (d) => {
      if (feedback) return;
      setInput((prev) => (prev.length >= 5 ? prev : prev + String(d)));
    },
    [feedback]
  );

  const handleDelete = useCallback(() => {
    if (feedback) return;
    setInput((prev) => prev.slice(0, -1));
  }, [feedback]);

  const handleDot = useCallback(() => {
    if (feedback) return;
    setInput((prev) => {
      if (prev.includes(".") || prev.length >= 5) return prev;
      return prev === "" ? "0." : prev + ".";
    });
  }, [feedback]);

  const handleSubmit = useCallback(() => {
    if (feedback || !input || !roundData) return;
    const val = parseFloat(input);
    if (val === roundData.total) {
      setFeedback("correct");
      const rTime = Date.now() - roundStart;
      setRoundResults((prev) => [...prev, { time: rTime, attempts }]);
      setTimeout(() => nextRound(), CORRECT_DELAY);
    } else {
      setFeedback("wrong");
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setFeedback(null);
        setInput("");
        setAttempts((a) => a + 1);
      }, 500);
    }
  }, [feedback, input, roundData, roundStart, attempts, nextRound]);

  const has25 = settings.enabledWeights.includes(2.5);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Key button style helper ───────────────────────────────────
  const kBtn = (disabled) => ({
    height: 52, borderRadius: 12, border: "none", fontWeight: 700,
    fontFamily: "'DM Mono', monospace",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    WebkitTapHighlightColor: "transparent",
  });

  return (
    <div
      style={{
        minHeight: "100vh", background: "#09090b", color: "#f4f4f5",
        fontFamily: "'DM Mono', monospace", overflowX: "hidden",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @keyframes shakeX{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
        .animate-shake{animation:shakeX .4s ease}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        body{margin:0;background:#09090b}
      `}</style>

      {/* ── START ──────────────────────────────────────── */}
      {screen === "start" && (
        <StartScreen onStart={startGame} bestTime={bestTime} settings={settings} onSettingsChange={setSettings} />
      )}

      {/* ── PLAY ───────────────────────────────────────── */}
      {screen === "play" && roundData && (
        <div className="flex flex-col items-center gap-2 px-3 pt-3 pb-4" style={{ minHeight: "100vh" }}>
          {/* Top bar */}
          <div className="flex justify-between items-center w-full max-w-xs">
            <button
              onClick={goHome}
              style={{
                background: "none", border: "none", color: "#71717a",
                fontSize: 12, fontFamily: "'DM Mono', monospace",
                cursor: "pointer", padding: "4px 0",
                display: "flex", alignItems: "center", gap: 4,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              EXIT
            </button>
            <div style={{ fontSize: 13, color: "#71717a" }}>
              <span style={{ color: "#f4f4f5", fontWeight: 700 }}>{round}</span>/{settings.totalRounds}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f4f4f5", fontVariantNumeric: "tabular-nums" }}>
              {formatTime(elapsed)}
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#52525b", textAlign: "center" }}>
            Bar = {settings.barWeight}kg · both sides identical
          </div>

          {/* Barbell */}
          <div className="w-full max-w-sm" style={{ marginTop: 2 }}>
            <BarbellView plates={roundData.plates} shake={shake} />
          </div>

          {/* Input display */}
          <div
            className="w-full max-w-xs flex items-center justify-center"
            style={{
              height: 58, borderRadius: 14,
              background:
                feedback === "correct" ? "rgba(22,163,74,0.15)"
                : feedback === "wrong" ? "rgba(220,38,38,0.15)"
                : "#18181b",
              border: `2px solid ${
                feedback === "correct" ? "#16A34A"
                : feedback === "wrong" ? "#DC2626"
                : "#27272a"
              }`,
              transition: "all 0.2s",
            }}
          >
            <span
              style={{
                fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                color:
                  feedback === "correct" ? "#16A34A"
                  : feedback === "wrong" ? "#DC2626"
                  : "#f4f4f5",
                minWidth: 40, textAlign: "center", letterSpacing: 3,
              }}
            >
              {input || <span style={{ color: "#3f3f46" }}>?</span>}
            </span>
            <span style={{ fontSize: 16, color: "#71717a", marginLeft: 4, fontWeight: 500 }}>kg</span>
          </div>

          {/* Keypad */}
          <div className="w-full max-w-xs" style={{ marginTop: 4 }}>
            <div className="grid grid-cols-3 gap-2" style={{ touchAction: "manipulation" }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
                <button
                  key={k} disabled={!!feedback}
                  onClick={() => handleDigit(k)}
                  className="select-none active:scale-95 transition-transform duration-75"
                  style={{ ...kBtn(!!feedback), fontSize: 22, background: "#27272a", color: "#f4f4f5" }}
                >
                  {k}
                </button>
              ))}
              {/* Bottom row */}
              <button
                disabled={!!feedback} onClick={handleDelete}
                className="select-none active:scale-95 transition-transform duration-75"
                style={{ ...kBtn(!!feedback), fontSize: 15, background: "#3f3f46", color: "#f4f4f5", letterSpacing: "0.05em" }}
              >
                DEL
              </button>
              <button
                disabled={!!feedback} onClick={() => handleDigit(0)}
                className="select-none active:scale-95 transition-transform duration-75"
                style={{ ...kBtn(!!feedback), fontSize: 22, background: "#27272a", color: "#f4f4f5" }}
              >
                0
              </button>
              {has25 ? (
                <button
                  disabled={!!feedback} onClick={handleDot}
                  className="select-none active:scale-95 transition-transform duration-75"
                  style={{ ...kBtn(!!feedback), fontSize: 22, background: "#27272a", color: "#f4f4f5" }}
                >
                  .
                </button>
              ) : (
                <div />
              )}
            </div>
            {/* Submit */}
            <button
              disabled={!!feedback} onClick={handleSubmit}
              className="select-none active:scale-95 transition-transform duration-75 w-full"
              style={{
                ...kBtn(!!feedback), fontSize: 17, background: "#16A34A",
                color: "#fff", letterSpacing: "0.08em", marginTop: 8, width: "100%",
              }}
            >
              SUBMIT
            </button>
          </div>
        </div>
      )}

      {/* ── RESULTS ────────────────────────────────────── */}
      {screen === "results" && (
        <ResultsScreen
          rounds={roundResults} totalTime={totalTime}
          bestTime={bestTime} onRestart={startGame} onHome={goHome}
        />
      )}
    </div>
  );
}
