# Velocity Lab — Complete Project Overview

## 🏁 What Is This?

**SprintGate** by **Velocity Lab** is a production-grade, low-cost automated athletic timing and AI biomechanical evaluation platform. It is a **cyber-physical system** that replaces expensive commercial timing gates (₹1.5L–₹8L) with a custom-built solution costing under **₹12,000 (~$145)**. It delivers Olympic-grade **±0.001s timing accuracy**.

> **Live App:** https://sprintgate-b84db.web.app  
> **Stack:** ESP32 firmware + React/Vite PWA + Firebase

---

## 📁 Repository Structure

```
velocity_lab/
├── sprintgate/                     ← Main project root
│   ├── web_app/                    ← React PWA (Vite + Tailwind)
│   │   └── src/
│   │       ├── App.jsx             ← Monolithic core (~7,568 lines)
│   │       ├── components/         ← 34 UI components
│   │       └── utils/              ← 15 utility/service files
│   ├── firmware/
│   │   ├── node_a_headless/        ← Start Gate ESP32 firmware (.ino)
│   │   ├── node_b_headless/        ← Finish Gate ESP32 firmware (.ino)
│   │   ├── node_c_headless/        ← Split gate (optional)
│   │   └── sprintgate_ble_node_b/  ← BLE variant firmware
│   ├── functions/                  ← Firebase Cloud Functions (email alerts)
│   ├── hardware/                   ← Mechanical quadrapod specs
│   ├── docs/                       ← Operator manual, project report
│   ├── firestore.rules             ← Firestore security rules
│   └── firebase.json
├── Exhibition/                     ← Exhibition poster & presentation
├── logo_Images/                    ← Brand assets (AI-generated logos)
├── 9mm-pistol-shot.mp3             ← Starting gun audio
└── Athlete_Sprint.mp4              ← Demo video
```

---

## 🏗️ System Architecture — "Headless Dual-Fire"

The system runs on a 3-node topology over a **mobile phone Wi-Fi hotspot**:

```
[Node A - Start Gate]  ── ESP-NOW Radio ──►  [Node B - Finish Gate]
   (ESP32 + LDR)          (primary)              (ESP32 + LDR + OLED)
        │                                              │
        └── HTTP (backup) ──────────────────────────►  └── WebSocket (Port 81)
                                                              │
                                                    [React PWA Dashboard]
                                                  (Phone/Tablet/Laptop)
```

### Node A — Start Gate (`node_a_headless.ino`)
- **ESP32** with LDR (Light Dependent Resistor) on GPIO 4, Buzzer on GPIO 5
- **PN532 RFID reader** (SPI) for athlete identification via NFC card
- Connects to hotspot SSID `"Velocity_Lab"` via mDNS as `startgate.local`
- **Broadcast fallback:** Runs as ESP-NOW radio station even without Wi-Fi
- Detects athlete's breaking the start beam via hardware interrupt (`RISING`)
- Sends events over **ESP-NOW broadcast** (broadcast MAC `FF:FF:FF:FF:FF:FF`)
- Exposes HTTP endpoints: `/gun` (fire starting gun), `/config` (buzzer mode)
- Supports 3 buzzer modes: `0=Mute`, `1=Race`, `2=Alignment`
- Sends **reaction time** (gun-to-start delay in ms) via ESP-NOW

### Node B — Finish Gate (`node_b_headless.ino`)
- **ESP32** with LDR on GPIO 4, Buzzer on GPIO 5, **SSD1306 OLED display**
- Dual Wi-Fi: Station mode (connects hotspot) + SoftAP (`SprintGate-Finish` / `sprintgate123`)
- Runs **HTTP server (Port 80)** + **WebSocket server (Port 81)**
- mDNS advertised as `finishgate.local`
- Receives ESP-NOW from Node A; computes sprint time upon finish beam break
- Supports **multi-runner FIFO queue** (up to 10 runners simultaneously on track)
- **USB-C Serial (115200 baud):** Streams continuous JSON telemetry for zero-latency cable mode
- Buffers up to 50 offline WebSocket events and flushes on client reconnect
- OLED shows: IP, beam status, runner count, time, MAC address
- HTTP endpoints: `/data`, `/config`, `/start`, `/reset`

### Web App (React PWA)
- **Vite + React 18** with **Tailwind CSS**
- Connects to Node B via **WebSocket (primary)** or **HTTP polling (fallback)**
- Also supports: **Web Bluetooth (BLE)** and **Web Serial (USB-C)** direct cable
- Auto-discovers ESP32 by scanning `192.168.43.x` and `172.20.10.x` subnet ranges

---

## 🖥️ Web App — Features

### Navigation Tabs
| Tab | Description |
|-----|-------------|
| `live` | Main timing cockpit — real-time clock, queue, gate status |
| `combine` | Combine Scorecard — multi-drill assessment (40m, shuttle, agility) |
| `analytics` | History, leaderboards, athlete profiles, FVP charts |
| `video` | Biomechanical video workspace (MediaPipe AI pose analysis) |

### Test Modes
| Mode | Description |
|------|-------------|
| `standard` | Configurable distance sprint (default 40m) |
| `mass_sprint` | Multi-runner FIFO pipeline heat timing |
| `shuttle` | 4×10m Agility Shuttle Run |
| `pro_agility` | 5-10-5 Pro Agility / Lateral Shuttle |
| `l_drill` | 3-Cone L-Drill |
| `rsa` | Repeated Sprint Ability (fatigue assessment) |

### Gate Connection Methods
1. **Wi-Fi WebSocket** — Primary; connects to `finishgate.local:81`
2. **Web Bluetooth (BLE)** — `SprintGateBleModal` + `bleSprintGateService.js`
3. **USB-C Web Serial** — `webSerialSprintGateService.js` — zero-latency direct cable

### Starting Cadence System (`soundEngine.js`)
- Full IAAF/World Athletics Rule 161.2 compliant starting sequence
- Stages: `idle → lead_in → marks → set → waiting_start → running → finished`
- Text-to-Speech (TTS) announcements (`speakLocalized`)
- Configurable beep lead-ins, set delays, gun sounds (real 9mm MP3 or synthesized)
- False start detection with threshold-based reaction time auditor
- Custom audio upload and storage (`customAudioStorage.js`)

### AI & Biometrics
- **MediaPipe 33-point Pose Estimation** (`BiomechanicalVideoWorkspace.jsx`)
- **Force-Velocity-Power (FVP) Profiling** (`fvpProfiling.js`, `HorizontalFVPModal.jsx`)
- **AI Bio Coach** (`aiBioCoachEngine.js`, `AIBioCoachDeck.jsx`) — generates training prescriptions
- **BLE Heart Rate Monitor** (`bleHeartRateService.js`, `BleHeartRateModal.jsx`)
- **60-second HRR (Heart Rate Recovery)** tracking post-sprint
- **Wind Speed** — manual or GPS-based auto-fetch (`windService.js`)
- **Reaction Time Auditor** (`ReactionTimeAuditorModal.jsx`)

### Performance Evaluation
```
evaluateRun(time, age, gender, distance):
  → Normative grading: Superior / Good / Average / Fair / Needs Work
  → Scaled thresholds per gender/age group (15-16, 17-18, 19-25)
  → F.I.T.T. training prescription
  → SPORT profile output
```

### Analytics & Reporting
- **Recharts** line graphs for performance progression
- **Sprint Split Delta Chart** — sector-by-sector breakdown
- **FieldRadarVisualizer** — agility metrics radar chart
- **Combine Scorecard** — multi-drill grading PDF
- **Athlete Scout Card** — sharable individual performance card
- **PDF export** via `jsPDF` + `jspdf-autotable` + custom logo embedding
- **CSV export** via `PapaParse`

### Social & Spectator Features
- **QR Badge** for each athlete profile
- **Spectator Live Scoreboard** (`SpectatorLiveScoreboard.jsx`) — URL param `?mode=spectator`
- **Jumbotron/Stadium Mode** for large display screens
- **Head-to-Head Matchup** comparison
- **Team Portal** — squad management, season stats, leaderboards
- **Multi-Device Field Sync** (`liveFieldSyncService.js`) — master/satellite roles

### Hardware Integration
- **Wind Gauge Controller** (`WindGaugeController.jsx`)
- **Gate Traffic Lights** (`GateTrafficLights.jsx`) — green/amber/red track status
- **Precision Clock Display** (`PrecisionClockDisplay.jsx`)
- **Cockpit HUD** (`CockpitHUD.jsx`)
- **Virtual Sprinter** simulator (`VirtualSprinter.jsx`)
- **Strobe Motion** photography tool (`StrobeMotionModal.jsx`)

---

## 🔥 Firebase Backend

| Collection | Purpose |
|------------|---------|
| `sprint_evaluations` | All timing results (online + offline synced) |
| `athletes` | Squad roster with profiles, bib, RFID UID, WhatsApp, email |
| `system_config` | Master admin config (`admin_meta` document) |
| `live_field_sessions` | Real-time multi-device state synchronization |

### Security Model
- **Single Master Admin** — only 1 Firebase Auth account permitted; enforced in Firestore rules and client
- Athletes login via **Bib Number + PIN** (no Firebase Auth; local roster lookup)
- Sprint evaluations: public read, anyone can create (gates write results), admin-only modify/delete
- `system_config` and `athletes`: admin-only write

### Cloud Function
- `sendSprintEvaluationEmail` — triggers on `sprint_evaluations` document creation, sends email via Gmail SMTP (nodemailer)

### Offline Mode
- `persistentLocalCache` with `CACHE_SIZE_UNLIMITED` for true offline Firestore
- `offlineTelemetryQueue.js` — IndexedDB-backed queue for unsynced runs
- Auto-sync on network reconnection (`window.addEventListener('online', ...)`)

---

## ⚙️ Hardware Design

### Quadrapod Stand
- **Base:** Single 5-way 1/2" PVC elbow connector → 4-legged base
- **Legs:** 4 × 40cm horizontal PVC, filled with dry sand (wind stability)
- **Mast:** 95cm vertical PVC riser → sensor at **90–100cm** (pelvic/CoM height)
- **Enclosure:** IP65 100×100×70mm weatherproof junction box
- **Optical system:** LDR + laser (tubular cylindrical hood, blocks 100,000 lux ambient)

---

## 🎨 UI/UX Design System
- **TailwindCSS** with dark/light/high-contrast themes
- Accent color picker: orange (default), electric blue, emerald, etc.
- `ThemeColorPicker.jsx` — runtime CSS variable injection via `data-theme-accent`
- **Screen Wake Lock API** — prevents screen sleep during timing sessions
- **PWA** — installable, works offline via `vite-plugin-pwa`
- Typography/Icons: `lucide-react`

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| `react` + `vite` | UI framework + build tool |
| `firebase` | Firestore, Auth, offline persistence |
| `@mediapipe/tasks-vision` | AI pose estimation |
| `recharts` | Data visualization |
| `jspdf` + `jspdf-autotable` | PDF report generation |
| `papaparse` | CSV import/export |
| `qrcode.react` + `html5-qrcode` | QR code generation & scanning |
| `lucide-react` | Icon library |
| `vite-plugin-pwa` | Progressive Web App support |

---

## 🗺️ Key Files to Know

| File | Description |
|------|-------------|
| [`App.jsx`](file:///d:/VS_Code/velocity_lab/sprintgate/web_app/src/App.jsx) | Main app — 7,568 lines; all state, timing engine, Firebase, UI |
| [`soundEngine.js`](file:///d:/VS_Code/velocity_lab/sprintgate/web_app/src/utils/soundEngine.js) | Starting cadence, TTS, all audio primitives |
| [`BiomechanicalVideoWorkspace.jsx`](file:///d:/VS_Code/velocity_lab/sprintgate/web_app/src/components/BiomechanicalVideoWorkspace.jsx) | MediaPipe AI pose analysis (291KB!) |
| [`bleSprintGateService.js`](file:///d:/VS_Code/velocity_lab/sprintgate/web_app/src/utils/bleSprintGateService.js) | Web Bluetooth gate integration |
| [`webSerialSprintGateService.js`](file:///d:/VS_Code/velocity_lab/sprintgate/web_app/src/utils/webSerialSprintGateService.js) | USB-C direct cable integration |
| [`liveFieldSyncService.js`](file:///d:/VS_Code/velocity_lab/sprintgate/web_app/src/utils/liveFieldSyncService.js) | Multi-device field station sync |
| [`node_b_headless.ino`](file:///d:/VS_Code/velocity_lab/sprintgate/firmware/node_b_headless/node_b_headless.ino) | Finish gate firmware |
| [`node_a_headless.ino`](file:///d:/VS_Code/velocity_lab/sprintgate/firmware/node_a_headless/node_a_headless.ino) | Start gate firmware |
| [`firestore.rules`](file:///d:/VS_Code/velocity_lab/sprintgate/firestore.rules) | Firestore security rules |

---

## 🔬 Performance Claims (from Exhibition Poster)
- **Timing accuracy:** ±0.001s (vs ±0.15–0.25s stopwatch)
- **ESP-NOW latency:** <1ms inter-node communication
- **Throughput:** 3.6× more athletes/minute than legacy single-gate systems
- **BOM cost:** <₹12,000 vs ₹1,50,000–₹8,00,000 commercial gates
- **Validated against:** 240 FPS high-speed camera ground truth

---

## 📌 Project Context
- **Organization:** Velocity Lab ("Engineering Human Speed")
- **Target markets:** Grassroots academies, Olympic combines, military/police screening, injury prevention clinics
- **Patent Status:** Utility patent pending on FIFO continuous-flow runner sync
- **Future roadmap:** WebBLE mesh, acoustic muzzle gun auto-sync, strobe motion photography
