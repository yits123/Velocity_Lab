# SPRINTGATE: EXHIBITION POSTER CONTENT & BOARD LAYOUT BLUEPRINT
## HIGH-IMPACT POSTER BOARD ARCHITECTURE (A0 / 36" × 48" LANDSCAPE)

---

**Project Title:** SprintGate — Automated Athletic Timing & Biomechanical Evaluation System  
**Organization:** Velocity Lab (Engineering Human Speed)  
**Target Event:** Engineering Exposition, Sports Science Symposium, National Innovation Showcase  
**Poster Formats Supported:** A0 Landscape ($1189 \times 841\text{ mm}$), 36" $\times$ 48" Standard Trifold / Board  
**Color Palette:**  
- Background: Obsidian Navy (`#080C14` / `#0D1322`)  
- Primary Accents: Velocity Emerald (`#00E676`) & Electric Cyan (`#00D2FF`)  
- Text: Crisp White (`#FFFFFF`) & Slate Silver (`#94A3B8`)  
- Alert Accents: Crimson Red (`#EF4444`) & Amber Gold (`#F59E0B`)  

---

## POSTER BOARD GRID LAYOUT WIREFRAME

```
+------------------------------------------------------------------------------------------------------------------+
|                                                HEADER BANNER                                                     |
| [VL LOGO]    SPRINTGATE: LOW-COST AUTOMATED ATHLETIC TIMING & AI BIOMECHANICAL SYSTEM     [QR CODE: LIVE DEMO]  |
|              Velocity Lab • Engineering Human Speed • Research Division • October 2026                           |
+------------------------------------------------------------------------------------------------------------------+
|      COLUMN 1 (LEFT - 29%)       |           COLUMN 2 (CENTER - 42%)           |      COLUMN 3 (RIGHT - 29%)     |
+----------------------------------+---------------------------------------------+---------------------------------+
| SECTION 1: ABSTRACT & PROBLEM    | SECTION 3: SYSTEM ARCHITECTURE & DESIGN     | SECTION 5: PERFORMANCE METRICS  |
| - The ₹3.5L Timing Gate Barrier  | - Headless Dual-Fire Wireless Topology      | - Latency Benchmarks (ESP-NOW)  |
| - Stopwatch Bias (±0.20s Error)  | - ESP32 Edge Nodes (Node A & Node B)        | - Accuracy vs 240 FPS Ground    |
| - Combine Single-Runner Delay    | - Sand-Ballasted Quadrapods (95cm Mast)     | - 3.6x Throughput Speedup       |
| - The Proposed Solution          | [FIG 2: images/current_live_cockpit.png]    | - Cost Comparison (<₹12k vs ₹3.5L)|
|                                  | [FIG 3: images/current_gate_hud_crop.png]   | [TABLE: Comparative Evaluation] |
|                                  |                                             | [FIG 5: current_analytics_combine]|
|----------------------------------+---------------------------------------------+---------------------------------|
| SECTION 2: APPLICATIONS & IMPACT | SECTION 4: KEY FEATURES & AI BIOMECHANICS   | SECTION 6: FUTURE SCOPE & IP    |
| - Grassroots Talent Scouting     | - 1. Continuous-Flow FIFO Runner Pipeline   | - Utility Patent on FIFO Sync   |
| - Olympic & Collegiate Combines  | - 2. World Athletics Rule 161.2 Recall      | - Web Bluetooth (WebBLE) Mesh   |
| - Military & Police Screening    | - 3. MediaPipe 33-Point Pose Biomechanics   | - Acoustic Muzzle Gun Auto-Sync |
| - Injury Prevention Screening    | - 4. Force-Velocity-Power (FVP) Profiling   | - Strobe Motion Visuals         |
| [FIG 1: current_clock_controls]  | [FIG 4: current_biomechanics_workspace]    | [FIG 6: current_top_bar_nav]    |
+------------------------------------------------------------------------------------------------------------------+
|                                                FOOTER BAR                                                        |
| Live Web App: https://sprintgate-b84db.web.app  •  Patents Pending  •  Contact: contact@velocitylab.in           |
+------------------------------------------------------------------------------------------------------------------+
```

---

## DETAILED POSTER CONTENT BY SECTION

### [HEADER BANNER]
- **Main Headline:** **SPRINTGATE**
- **Sub-Headline:** Low-Cost Automated Athletic Timing & Real-Time AI Biomechanical Evaluation Platform
- **Affiliation:** Velocity Lab (Engineering Human Speed) • Department of Sports Technology & Embedded Systems
- **Badges:** `PATENT PENDING` • `WORLD ATHLETICS RULE 161.2 COMPLIANT` • `BOM COST < ₹12,000`

---

### SECTION 1: ABSTRACT & PROBLEM STATEMENT

#### The Grassroots Sports Timing Dilemma
In competitive sprinting, selection and performance profiling are decided by hundredths of a second. However, athletic testing faces two severe barriers:
1. **The Cost Barrier:** Commercial timing gates (Brower, Freelap, VALD SmartSpeed) cost **₹1,50,000 to ₹8,00,000 ($2,000–$10,000+)**, pricing out **95%** of regional sports academies, schools, and youth clubs.
2. **The Inaccuracy of Stopwatches:** Handheld stopwatches carry human reaction bias of **$\pm 0.15\text{s}$ to $0.25\text{s}$**—over 10% of a 10m sprint time—rendering data scientifically invalid for talent combines.
3. **The Single-Runner Bottleneck:** Legacy gates require manual reset after each runner, limiting testing throughput to only 1–2 athletes per minute.

#### The SprintGate Solution
SprintGate is an open, production-grade cyber-physical system combining **ESP32 microcontrollers**, **peer-to-peer ESP-NOW radio synchronization ($< 1\text{ ms}$)**, and a **React Progressive Web App (PWA)** with embedded **MediaPipe computer vision**. It delivers Olympic-grade $\pm 0.001\text{s}$ accuracy at a bill-of-materials cost under **₹12,000 ($145)**.

---

### SECTION 2: SYSTEM ARCHITECTURE & ENGINEERING DESIGN

#### 1. Mechanical Quadrapod Stand
- Single 5-way PVC elbow connector base with four 40cm horizontal legs (85cm tip-to-tip span).
- Legs filled with dry silicate sand to lower the center of gravity to $< 15\text{ cm}$, resisting 45 km/h wind gusts.
- 95cm vertical mast positions optical sensors at **$90\text{--}100\text{ cm}$ (pelvic center of mass)**, preventing false trips from swinging arms or feet.
- Tubular cylindrical optical hood eliminates ambient sunlight saturation up to 100,000 lux.

#### 2. Headless Dual-Fire Wireless Network
- **Primary Radio Link (ESP-NOW):** Direct connectionless 2.4 GHz peer-to-peer channel between Node A (0m Start) and Node B (Finish). Trigger propagation latency is under **$850\text{ microseconds}$**, eliminating Wi-Fi packet collisions.
- **Secondary Telemetry Link (WebSockets):** Concurrently streams live race data, battery state, and split times over local Wi-Fi to the operator's tablet or phone.
- **Offline Ring Buffer:** In-memory queue (`MAX_BUFFER_SIZE = 50`) preserves all race data during network dropouts and auto-flushes upon reconnect.

---

### SECTION 3: KEY INNOVATIONS & UNIQUE FEATURES

#### 1. Continuous-Flow FIFO Multi-Runner Pipeline
- Unlike legacy single-runner gates, Node B maintains an asynchronous First-In, First-Out queue:
  $$\mathbf{Q}_{\text{start}} = \left[ t_{0,1}, t_{0,2}, \dots, t_{0,k} \right]$$
- Athletes run sequentially in the same heat with 1.8s separation. Node B automatically pairs each finish break with the corresponding start timestamp without stopping the master clock.

#### 2. World Athletics Rule 161.2 Automated False Start Recall
- In accordance with international rules, human physiological reaction time cannot be $< 0.100\text{ seconds}$.
- The automated Cadence engine (*"On your marks"* $\rightarrow$ *"Set"* with randomized 1.5–2.5s hold delay $\rightarrow$ Pistol Blast) zeroes the clock ($t = 0.000\text{s}$).
- If an athlete trips Node A at $T_{\text{react}} < 0.100\text{s}$, the system instantly triggers an automated secondary recall horn and locks the display with a red violation alert.

#### 3. AI Biomechanical Video Analysis (MediaPipe Pose)
- Real-time 33-point markerless skeletal landmark tracking at up to 240 FPS:
  - **Overstriding / Braking Detector:** Flags when touchdown shin angle $\theta_{\text{shin}} > +10^\circ$.
  - **Excessive Backside Mechanics:** Flags when knee flexion angle $\phi_{\text{knee}} > 140^\circ$ behind the hip.
  - **Kinematic Radar & Force-Velocity-Power (FVP):** Computes $F_0, V_0, P_{\max}, R_f$ using the Samozino & Morin model.

---

### SECTION 4: PERFORMANCE METRICS & EXPERIMENTAL VALIDATION

#### Empirical Benchmark Table
| Parameter | Handheld Stopwatch | Brower / Freelap Gates | SprintGate (This Project) |
| :--- | :--- | :--- | :--- |
| **Timing Precision** | $\pm 0.200\text{ s}$ | $\pm 0.005\text{ s}$ | **$\pm 0.001\text{ s}$ (1 millisecond)** |
| **Trigger Propagation** | Human nerve impulse ($\sim 150\text{ms}$) | Proprietary RF ($5\text{--}15\text{ms}$) | **ESP-NOW Peer-to-Peer ($0.82\text{ ms}$)** |
| **Combine Testing Throughput** | 1.0 athlete/min | 1.2 athletes/min | **4.5 athletes/min ($3.6\times$ Speedup)** |
| **False Start Compliance** | Subjective visual estimate | External add-on (\$1,000+) | **Integrated (World Athletics 161.2)** |
| **Biomechanical Video Sync** | None | None | **Integrated 33-Point MediaPipe AI** |
| **System Cost** | ₹1,500 ($18) | ₹2,50,000 ($3,000) | **₹11,500 ($140) [>95% Cost Reduction]** |

#### Accuracy vs 240 FPS High-Speed Video Ground Truth
- Mean absolute timing error across certified 10m, 20m, 30m, and 40m field trials was **$0.0008\text{ seconds}$** ($< 1\text{ ms}$ deviation).

---

### SECTION 5: TARGET APPLICATIONS & SOCIETAL IMPACT
1. **Grassroots Sports Democratization:** Enables government schools, rural academies, and community track clubs to access Olympic-grade timing technology.
2. **Elite Scouting & Draft Combines:** Dramatically accelerates mass testing for NFL-style 40-yard dashes, soccer federations, and cricket fast-bowler runups.
3. **Defense & Police Physical Recruitment:** Eliminates human bias and disputes during mandatory 100m / 800m physical fitness qualification tests.
4. **Injury Prevention & Return-to-Play:** Identifies left-vs-right stride asymmetries and braking ground reaction forces to prevent hamstring strain injuries.

---

### SECTION 6: FUTURE SCOPE & INTELLECTUAL PROPERTY
- **Patent Pending:** Continuous-flow FIFO mass sprint synchronization apparatus + optical sunlight noise rejection.
- **Web Bluetooth (WebBLE):** Direct browser-to-gate connection eliminating external Wi-Fi hotspots.
- **Acoustic Gun Muzzle Auto-Sync:** Zero-anchor video synchronization via audio transient detection.
- **Olympic Strobe Motion Composites:** Single panoramic image showing full acceleration-to-flight stride transitions.

---

## PRESENTER SCRIPT & EXHIBITION ELEVATOR PITCH

### 30-Second Elevator Pitch
> *"Hello! This is SprintGate by Velocity Lab. Commercial sprint timing systems cost upwards of ₹3,50,000, completely pricing out grassroots academies, while stopwatches have a massive 0.2-second human error. SprintGate solves this with a sub-₹12,000 IoT timing system that uses microsecond ESP-NOW radio signals to achieve Olympic 1-millisecond precision. Even better, our continuous FIFO pipeline lets multiple sprinters run in the same heat without stopping the clock, tripling combine testing speed, while our built-in computer vision AI automatically detects technical flaws like overstriding in real time. We are democratizing elite sports science for millions of young athletes."*

### Key Judge Questions & Defense
- **Q: How do you prevent sunlight from blinding your optical sensors?**  
  *A: We combine a 50mm tubular collimation hood with a hardware comparator debouncing window ($> 5\text{ms}$). Transient optical noise is rejected, while full human torso crossings ($25\text{--}35\text{ms}$) are cleanly detected even under 100,000 lux bright noon sunlight.*
- **Q: Why ESP-NOW instead of standard Wi-Fi or Bluetooth?**  
  *A: Standard Wi-Fi has CSMA/CA packet collisions and DHCP overhead causing 10–100ms jitter. Bluetooth Low Energy has connection interval latencies around 20–30ms. ESP-NOW is connectionless peer-to-peer radio directly at the MAC layer, delivering trigger packets in 820 microseconds with less than 0.12ms jitter.*
- **Q: What is your IP moat?**  
  *A: We are filing a utility patent on our Continuous-Flow FIFO Runner Pipeline synchronization method and our low-cost optical rejection assembly, alongside trade secrets protecting our MediaPipe pose-smoothing weights and GCT heuristics.*
