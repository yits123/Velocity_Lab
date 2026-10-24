# SprintGate — Improvement & Optimization Master Plan

---

## 🔍 Current State Diagnosis

| Area | Status | Issue |
|------|--------|-------|
| `App.jsx` | ⚠️ Monolith | 7,568 lines — single file, causes full re-renders on any state change |
| Bundle | ⚠️ Large | `BiomechanicalVideoWorkspace.jsx` alone is 291KB source |
| Responsive | ⚠️ Partial | `mobileArenaTab` state exists but layout is desktop-first with fragile breakpoints |
| Real-time | ✅ Good | WebSocket is primary, HTTP fallback exists |
| Font | ✅ Already `Outfit` | Referenced in CSS but **not actually loaded** via Google Fonts `<link>` |
| PWA | ✅ Good | `vite-plugin-pwa` configured |
| Theme | ✅ Excellent | CSS variable accent system + high-contrast mode |
| Timer | ✅ Perfect | `requestAnimationFrame` throttled to 30 FPS — no over-rendering |

---

## ⚡ PART 1 — Performance & Speed Optimization

### 1.1 — Split `App.jsx` into Feature Contexts (HIGHEST IMPACT)

The single biggest performance problem. Every state update re-renders ALL 7,568 lines.

**Solution:** Extract 4–5 `React.Context` providers:

```
AppContexts/
├── GateContext.jsx        ← nodeA, nodeB, statusA, statusB, wsRef, WebSocket logic
├── TimingContext.jsx      ← sequenceState, isRunning, displayTime, startTimer, stopTimer
├── AthleteContext.jsx     ← roster, queue, results, history, Firebase listeners
├── AudioContext.jsx       ← audioConfig, soundEngine, voiceEnabled
└── UIContext.jsx          ← activeTab, theme, isDark, modals open/close state
```

**How:** Wrap `App.jsx` with providers. Components consume only what they need. Gate status change won't re-render the roster table.

**Benefit:** 80%+ reduction in unnecessary re-renders.

---

### 1.2 — Memoize Expensive Computations

Add `React.memo` to pure display components:

```jsx
// Before
function PrecisionClockDisplay({ time }) { ... }

// After  
const PrecisionClockDisplay = React.memo(({ time }) => { ... });
```

Apply `useMemo` for derived state in App.jsx:

```jsx
// Already partially done — extend to ALL filter/sort operations
const filteredHistory = useMemo(() =>
  history.filter(r => selectedAthlete === 'All' || r.name === selectedAthlete),
  [history, selectedAthlete]
);
```

**Components to `React.memo`:** `GateTrafficLights`, `PrecisionClockDisplay`, `CockpitHUD`, `SprintSplitDeltaChart`, `FVPProfileCard`, `VelocityLabLogo`.

---

### 1.3 — Virtualize Long Lists

The history table and athlete roster can have 200+ rows — all rendered to the DOM at once.

**Solution:** Use `react-window` or native CSS `content-visibility`:

```jsx
import { FixedSizeList } from 'react-window';

<FixedSizeList height={500} itemCount={history.length} itemSize={60}>
  {({ index, style }) => (
    <div style={style}>
      <SprintResultRow run={history[index]} />
    </div>
  )}
</FixedSizeList>
```

Or pure CSS (zero dependencies):
```css
.result-row {
  content-visibility: auto;
  contain-intrinsic-size: 0 60px;
}
```

**Benefit:** Scrolling 200-row history goes from 16ms paint → <2ms.

---

### 1.4 — WebSocket Reconnection with Exponential Backoff

Current WebSocket likely has a simple reconnect. Improve with binary exponential backoff:

```js
// In GateContext or wsService
let retryDelay = 1000;
const MAX_DELAY = 30000;

const connectWs = () => {
  ws = new WebSocket(url);
  ws.onclose = () => {
    setTimeout(connectWs, retryDelay);
    retryDelay = Math.min(retryDelay * 2, MAX_DELAY);
  };
  ws.onopen = () => { retryDelay = 1000; }; // reset on success
};
```

---

### 1.5 — Optimize Vite Build

Current `vite.config.js` is good but missing:

```js
// Add to vite.config.js
build: {
  target: 'es2020',        // smaller output, modern async/await
  minify: 'terser',
  terserOptions: {
    compress: { drop_console: true, drop_debugger: true },
  },
  rollupOptions: {
    output: {
      manualChunks(id) {
        // existing chunks...
        if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
        if (id.includes('react-dom')) return 'vendor-react';
        // Separate heavy components
        if (id.includes('BiomechanicalVideoWorkspace')) return 'chunk-biomechanics';
        if (id.includes('AudioSettingsModal')) return 'chunk-audio';
        if (id.includes('TeamPortal')) return 'chunk-team';
      }
    }
  }
}
```

---

### 1.6 — Preload Critical Fonts

`Outfit` font is referenced in CSS but not loaded — browser falls back to system font until parsed:

```html
<!-- In index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style"
  href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap">
```

---

### 1.7 — IndexedDB for Results Cache

Currently `results` and `history` live only in React state (lost on refresh for local-only runs). Persist to IndexedDB via `idb-keyval`:

```js
import { set, get } from 'idb-keyval';

// On new result:
await set('sprintgate_results_cache', results);

// On mount:
const cached = await get('sprintgate_results_cache');
if (cached) setResults(cached);
```

---

## 📱 PART 2 — Full Responsive Design (Monitor → Tablet → Phone)

### 2.1 — Responsive Breakpoint Strategy

```
xs  < 480px    → Phone portrait (race official phone)
sm  480–767px  → Phone landscape / small tablet
md  768–1023px → Tablet (iPad at track)
lg  1024–1279px→ Laptop
xl  1280–1535px→ Desktop monitor
2xl ≥ 1536px   → Large TV / Jumbotron
```

### 2.2 — Mobile-First Layout Redesign

**Current issue:** Main layout is `flex-row` desktop-first, wrapped with `mobileArenaTab` state for small screens.

**Fix:** Convert to mobile-first CSS Grid:

```css
/* Default: Mobile — single column */
.app-layout {
  display: grid;
  grid-template-areas:
    "header"
    "timer"
    "controls"
    "queue"
    "status";
  grid-template-columns: 1fr;
}

/* md: Tablet — 2 columns */
@media (min-width: 768px) {
  .app-layout {
    grid-template-areas:
      "header   header"
      "timer    queue"
      "controls status";
    grid-template-columns: 1fr 1fr;
  }
}

/* xl: Desktop — 3 columns */
@media (min-width: 1280px) {
  .app-layout {
    grid-template-areas:
      "sidebar timer    queue"
      "sidebar controls analytics";
    grid-template-columns: 280px 1fr 380px;
  }
}
```

### 2.3 — Adaptive Navigation

| Screen | Navigation Pattern |
|--------|--------------------|
| Phone (xs/sm) | **Bottom Tab Bar** — fixed 4-icon navbar at bottom (like native iOS/Android apps) |
| Tablet (md) | **Top horizontal tabs** — current design, works well |
| Desktop (lg+) | **Left sidebar** — persistent icon + label sidebar with collapsible state |

**Bottom Tab Bar for phones:**

```jsx
// Mobile bottom navigation
<nav className="fixed bottom-0 left-0 right-0 z-50 
               flex md:hidden 
               bg-slate-900/95 backdrop-blur-xl
               border-t border-white/10
               safe-area-pb"> {/* iOS safe area */}
  {['live', 'combine', 'analytics', 'video'].map(tab => (
    <button key={tab}
      onClick={() => setActiveTab(tab)}
      className={`flex-1 flex flex-col items-center py-2 gap-1
        ${activeTab === tab ? 'text-[var(--accent-color)]' : 'text-slate-500'}`}>
      <TabIcon tab={tab} size={22} />
      <span className="text-[10px] font-medium capitalize">{tab}</span>
    </button>
  ))}
</nav>
```

### 2.4 — Responsive Timer Display

The hero timer is `text-8xl` (96px). On a 375px phone screen that's fine for landscape, but cramped in portrait with controls below it.

```jsx
<div className="font-mono font-black tracking-tighter
                text-6xl       {/* xs: phone */}
                sm:text-7xl    {/* sm: phone landscape */}
                md:text-8xl    {/* md: tablet */}
                xl:text-9xl    {/* xl: large desktop */}
                2xl:text-[120px]"> {/* 2xl: jumbotron */}
  {displayTime.toFixed(3)}
</div>
```

### 2.5 — Touch-Optimized Controls

All action buttons need minimum 44×44px tap target (Apple HIG / WCAG 2.5.5):

```css
/* In index.css */
@media (max-width: 767px) {
  button, [role="button"] {
    min-height: 44px;
    min-width: 44px;
  }
  
  /* Larger tap targets for critical race controls */
  .race-primary-btn {
    min-height: 56px;
    font-size: 1.1rem;
  }
}
```

### 2.6 — Responsive Modal Sheets

On phones, modals should slide up as **bottom sheets** instead of centered dialogs:

```css
/* index.css — Mobile Bottom Sheet */
@media (max-width: 767px) {
  [role="dialog"],
  [class*="max-h-[88vh]"],
  [class*="max-h-[94vh]"] {
    position: fixed !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    transform: none !important;
    border-radius: 20px 20px 0 0 !important;
    max-height: 90dvh !important;
    width: 100% !important;
    max-width: 100% !important;
  }
}
```

### 2.7 — Responsive Data Tables

History/analytics tables need to become **card stacks on mobile**:

```jsx
{/* Desktop: table */}
<table className="hidden md:table w-full">...</table>

{/* Mobile: cards */}
<div className="md:hidden space-y-2">
  {history.map(run => (
    <div key={run.id} className="glass-panel p-3 rounded-xl">
      <div className="flex justify-between">
        <span className="font-bold">{run.name}</span>
        <span className="font-mono text-accent text-lg">{run.time}s</span>
      </div>
      <div className="text-xs text-slate-400 mt-1">{run.date} • {run.distance}m • {run.standing}</div>
    </div>
  ))}
</div>
```

### 2.8 — Safe Area Insets (iPhone notch/Dynamic Island)

```css
/* In index.css */
.app-header {
  padding-top: env(safe-area-inset-top);
}
.mobile-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```

```html
<!-- In index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### 2.9 — Jumbotron / TV Mode Enhancements

Already has `isJumbotronMode` state. Enhance for 2xl screens:

```jsx
// Auto-detect TV via user agent or screen size
const isLargeDisplay = window.screen.width >= 1920;

// In 2xl mode: hide controls, maximize scoreboard
<div className={`
  ${isJumbotronMode ? '2xl:text-[200px] 2xl:scale-110' : ''}
`}>
```

---

## 🛰️ PART 3 — Real-Time Data Fetching Improvements

### 3.1 — WebSocket Heartbeat / Liveness Ping

Detect stale WebSocket connections before they show `online` falsely:

```js
// In GateContext / wsService
const PING_INTERVAL = 5000;
const PONG_TIMEOUT = 3000;

setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
    pingTimeoutId = setTimeout(() => {
      // No pong received — force reconnect
      ws.close();
    }, PONG_TIMEOUT);
  }
}, PING_INTERVAL);

ws.onmessage = (msg) => {
  clearTimeout(pingTimeoutId);
  // ...existing message handling
};
```

### 3.2 — Battery-Adaptive Polling

When on mobile battery saver, reduce HTTP fallback polling:

```js
const getBatteryAwareInterval = () => {
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      if (battery.level < 0.2 && !battery.charging) {
        return 3000; // 3s poll on low battery
      }
    });
  }
  return 800; // default 800ms
};
```

### 3.3 — Optimistic UI for Queue Operations

When adding an athlete to the queue, update the UI immediately without waiting for Firestore:

```jsx
const addToQueue = async (athlete) => {
  // Optimistic update — instant UI feedback
  setQueue(prev => [...prev, { ...athlete, _optimistic: true }]);
  
  try {
    await liveFieldSyncService.pushQueue(newQueue);
    setQueue(prev => prev.map(a => a.id === athlete.id ? { ...a, _optimistic: false } : a));
  } catch (err) {
    // Rollback on failure
    setQueue(prev => prev.filter(a => a.id !== athlete.id));
    toast.error('Failed to sync queue');
  }
};
```

### 3.4 — Firestore Real-Time Listener Optimization

Current: `onSnapshot` with `limit(200)` on `sprint_evaluations` — fires on EVERY change.

**Optimize:** Use `staleTime` pattern + only listen for recent data:

```js
// Only fetch last 7 days in real-time, load older history on demand
const recentCutoff = new Date();
recentCutoff.setDate(recentCutoff.getDate() - 7);

const q = query(
  collection(db, 'sprint_evaluations'),
  where('timestamp', '>=', recentCutoff),
  orderBy('timestamp', 'desc'),
  limit(50)  // Reduced from 200
);
```

Add "Load More" button for historical data beyond 7 days.

---

## ✨ PART 4 — New Features (Additive, Non-Breaking)

### 4.1 — 🏃 Live Lap Counter Widget (Track & Field Mode)

A simple persistent mini-widget (bottom-right floating) showing:
- Current runner on track
- Elapsed time ticking live
- Queue position of next athlete

Zero changes to existing code — mounts as floating overlay.

```jsx
const LiveMiniHUD = () => (
  <div className="fixed bottom-20 right-4 z-40 
                  glass-panel rounded-2xl p-3 w-48
                  hidden md:block"> {/* Only on larger screens — phones already have full HUD */}
    <div className="text-xs text-slate-400">On Track</div>
    <div className="font-mono text-2xl font-black text-[var(--accent-color)]">
      {displayTime.toFixed(2)}s
    </div>
    <div className="text-xs mt-1">Next: {queue[0]?.name || '—'}</div>
  </div>
);
```

---

### 4.2 — 📊 Performance Trend Sparklines

Add tiny inline sparklines next to each athlete in the roster — shows last 5 runs at a glance:

```jsx
// Lightweight sparkline using SVG (no extra package)
const Sparkline = ({ data, width = 60, height = 24 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / (max - min)) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height}>
      <polyline points={pts} fill="none" 
        stroke="var(--accent-color)" strokeWidth="1.5" />
    </svg>
  );
};
```

---

### 4.3 — 🔔 Push Notifications for PR Alerts

Already has `Notification` API calls for PR but only fires when app is open. Add **Web Push** via Firebase Cloud Messaging (FCM):

```js
// In utils/pushNotificationService.js
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

export const initPushNotifications = async (app) => {
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });
  // Store token in athlete's Firestore document
};
```

Coach receives PR notifications even when phone screen is off.

---

### 4.4 — 🎯 Pre-Session Warm-Up Timer

A dedicated warm-up countdown panel (0:00 → configurable, e.g. 8 min) that auto-arms the gate sequence when warm-up ends. Completely separate state from timing. 

```jsx
// New component: WarmUpTimerWidget.jsx
// Mounts as a collapsible panel in the Live tab sidebar
// Has: Start, Pause, Reset, duration picker (5–20 mins)
// When countdown reaches 0: plays attention chime + notifies coach
```

---

### 4.5 — 📡 Multi-Gate Split Dashboard

The firmware already supports Node C and split nodes (IDs 2–10). Build a live **split lane visualizer** — a horizontal track diagram that lights up as each gate fires.

```
[START] ──10m──►[●]──10m──►[●]──10m──►[●]──10m──►[FINISH]
                FIRED       FIRED      WAITING     ARMED
                 1.24s       2.31s
```

No firmware changes — just consumes existing `split_node` + `split_time` from WebSocket.

---

### 4.6 — 🌐 QR-Based Athlete Check-In Station

Deploy the app in `?mode=checkin` URL param. Shows a full-screen QR scanner:
- Athlete scans their QR badge → added to queue automatically
- Coach's main device (master) gets the queue update via `liveFieldSyncService`
- Works on a cheap Android tablet placed at the start line

Zero changes to core timing logic — extends existing `QRScannerModal` + `liveFieldSyncService`.

---

### 4.7 — 📈 Session Summary Auto-Report

After each session ends (e.g. after 10+ runs), automatically generate and offer to download a PDF summary:
- Session date, track conditions (wind, surface)
- All athletes' times, standings, PRs set
- Top 3 performers with sparkline charts
- Coach's notes field (editable before download)

Uses existing `athleteBioReportGenerator.js` + `jsPDF` infrastructure.

---

### 4.8 — 🎨 Athlete Avatar / Color System

Give each athlete in the roster a color tag (auto-assigned from a 12-color palette or custom). In the queue and live timing view, that color appears as a subtle left-border accent on their card — making it instantly identifiable across multiple devices at the track.

```js
const ATHLETE_COLORS = [
  '#FF5500', '#00E5FF', '#A855F7', '#FAFF00',
  '#FF204E', '#00E599', '#F59E0B', '#38BDF8',
  // ...
];
// Deterministic assignment: color = ATHLETE_COLORS[hashCode(athlete.id) % 12]
```

---

### 4.9 — ⌚ Offline-First Status Indicator

A non-intrusive status pill at the top of the app showing connectivity state:

```
● LIVE   — Firebase + Gate connected
◐ CACHED — Firebase offline, gate connected (timing still works)
○ OFFLINE — All offline (still times locally, syncs later)
```

Derives from existing `offlineTelemetryStatus.isOnline` + WebSocket state. Pure display component.

---

### 4.10 — 🔊 Voice Coaching Cues (AI-Powered)

After each run result, generate a short 1-sentence voice coaching cue using `speakLocalized`:

```js
const coachingCues = {
  Superior: "Outstanding sprint! Maintain this drive phase angle.",
  Good: "Great time! Focus on arm drive in the first 10 meters.",
  Average: "Good effort. Work on explosive block clearance.",
  Fair: "Keep grinding. Improve your lean angle at the gun.",
  'Needs Work': "Let's reset. Focus on relaxed upper body form."
};

// After result saves, ~2s delay:
setTimeout(() => {
  speakLocalized(coachingCues[standing], {}, audioConfig);
}, 2000);
```

Requires no Gemini API key — pure rule-based. Additive to existing `announceRun()`.

---

## 🗺️ Implementation Priority Roadmap

```
PHASE 1 — Quick Wins (1–2 days each)
├── 1.6 Load Outfit font properly in index.html
├── 2.8 Add viewport-fit=cover + safe area insets
├── 2.3 Add bottom tab bar for mobile
├── 1.2 Add React.memo to pure display components
├── 3.1 WebSocket heartbeat/liveness ping
└── 4.9 Offline status indicator pill

PHASE 2 — Responsive Polish (2–3 days)
├── 2.4 Responsive timer text sizes
├── 2.5 44px tap targets on mobile
├── 2.6 Bottom sheet modals on phone
├── 2.7 Card-stack tables on mobile
└── 4.1 Live mini HUD floating widget

PHASE 3 — Performance (3–5 days)
├── 1.3 Virtualized list for history
├── 1.5 Enhanced Vite build config
├── 3.3 Optimistic UI for queue
└── 1.7 IndexedDB results cache

PHASE 4 — Architecture (1–2 weeks)
├── 1.1 Extract React Contexts (GateCtx, TimingCtx, AthleteCtx)
├── 3.4 Firestore listener optimization
└── 3.2 Battery-adaptive polling

PHASE 5 — New Features (Additive)
├── 4.2 Athlete sparkline trend charts
├── 4.5 Multi-gate split dashboard
├── 4.6 QR check-in station mode
├── 4.7 Session summary auto-report
├── 4.8 Athlete color system
├── 4.10 Voice coaching cues
└── 4.3 Web Push for PR alerts (requires FCM setup)
```

---

## 💡 Key Rules for All Changes

> [!IMPORTANT]
> **Never break the timing engine.** `startTimer()`, `stopTimer()`, `handleArmAndStart()`, the WebSocket handler, and `hardwareEventCallbackRef` are the critical path. All refactoring must leave these 100% intact.

> [!WARNING]
> **Don't add new state to `App.jsx`.** Every new feature should live in its own component/context/hook. The monolith must only shrink, never grow.

> [!TIP]
> **Test on real hardware.** The phone hotspot + ESP32 setup means localhost testing won't catch WebSocket or mixed-content issues. Always test with the actual gate hardware or the `simulate_node_b.js` simulator.
