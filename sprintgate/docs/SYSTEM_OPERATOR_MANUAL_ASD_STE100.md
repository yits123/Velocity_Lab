# VELOCITY LAB SPRINTGATE
## TECHNICAL SYSTEM OPERATOR MANUAL
### PREPARED IN ACCORDANCE WITH ASD-STE100 (SIMPLIFIED TECHNICAL ENGLISH)

---

**DOCUMENT IDENTIFICATION:** SG-MAN-STE100-001  
**SYSTEM NAME:** Velocity Lab SprintGate Automated Athletic Evaluation System  
**ISSUE DATE:** OCTOBER 2026  
**REVISION:** 2.2  
**COMPLIANCE STANDARD:** ASD-STE100 (Simplified Technical English, Issue 8)  
**SECURITY CLASSIFICATION:** COMMERCIAL UNCLASSIFIED  

---

## TABLE OF CONTENTS

1. [SECTION 1: INTRODUCTION AND GENERAL DESCRIPTION](#section-1-introduction-and-general-description)
2. [SECTION 2: SAFETY SUMMARY AND WARNINGS](#section-2-safety-summary-and-warnings)
3. [SECTION 3: TECHNICAL AND ELECTRICAL SPECIFICATIONS](#section-3-technical-and-electrical-specifications)
4. [SECTION 4: MECHANICAL AND SENSOR STAND ASSEMBLY](#section-4-mechanical-and-sensor-stand-assembly)
5. [SECTION 5: OPTICAL AND DUAL-BEAM ALIGNMENT PROCEDURES](#section-5-optical-and-dual-beam-alignment-procedures)
6. [SECTION 6: NETWORK AND WIRELESS INITIALIZATION (WI-FI, ESP-NOW, WEBBLE)](#section-6-network-and-wireless-initialization-wi-fi-esp-now-webble)
7. [SECTION 7: OPERATING PROCEDURES AND SPRINT PROTOCOLS](#section-7-operating-procedures-and-sprint-protocols)
8. [SECTION 8: BIOMECHANICAL VIDEO WORKSPACE AND MOTION ANALYSIS](#section-8-biomechanical-video-workspace-and-motion-analysis)
9. [SECTION 9: PERIPHERAL SENSORS AND ENVIRONMENTAL AUDIT](#section-9-peripheral-sensors-and-environmental-audit)
10. [SECTION 10: FAULT ISOLATION, DIAGNOSTIC CODES, AND MAINTENANCE](#section-10-fault-isolation-diagnostic-codes-and-maintenance)

---

## SECTION 1: INTRODUCTION AND GENERAL DESCRIPTION

### 1.1 Purpose of the System
The Velocity Lab SprintGate system measures the running performance of athletes.  
The system records sprint times, reaction times, split intervals, and biomechanical parameters.  
The system gives precise data to coaches and sports scientists.

### 1.2 System Overview
The SprintGate system uses two or more wireless timing nodes:
- **Node A (Start Gate):** Monitors the launch line at 0 meters.
- **Node B (Finish Gate):** Monitors the finish line at 10, 20, 30, 40, 50, 60, or 100 meters.
- **Node C (Split Gate):** Monitors intermediate distance points.
- **Node B BLE Gateway:** Connects to mobile devices with direct Web Bluetooth (WebBLE).
- **Web Application Dashboard:** Runs on a tablet, computer, or smartphone.

The system uses a headless dual-fire communication architecture.  
Node A and Node B communicate directly with peer-to-peer ESP-NOW radio signals.  
Both nodes also connect to a central wireless local area network (Wi-Fi).  
The web dashboard receives live telemetry through WebSockets and HTTP.

```
       +------------------+                    +------------------+
       |   START GATE     |                    |   FINISH GATE    |
       |    (NODE A)      |                    |    (NODE B)      |
       |  Line: 0 Meters  |                    |  Line: 10-100 m  |
       +--------+---------+                    +--------+---------+
                |                                       |
                | <--- Primary ESP-NOW Wireless Sync ---> |
                |      (Sub-Millisecond Peer Link)      |
                |                                       |
                +-------------------+-------------------+
                                    |
                            2.4 GHz Local Wi-Fi
                                    |
                         +----------v----------+
                         |  CENTRAL WI-FI AP   |
                         |   (Mobile Hotspot)  |
                         +----------+----------+
                                    |
                                WebSockets
                                    |
                         +----------v----------+
                         |  WEB APP DASHBOARD  |
                         | (Operator Cockpit)  |
                         +---------------------+
```

### 1.3 Main System Components
1. **Node A Assembly (Start Gate):**
   - Weatherproof enclosure (IP65)
   - ESP32 microcontroller (240 MHz dual-core)
   - Optical photodetector sensor on GPIO 4
   - Audio buzzer unit on GPIO 5
   - PN532 RFID / NFC tag scanner (SPI interface)
   - Rechargeable 5.0 V battery pack

2. **Node B Assembly (Finish Gate):**
   - Weatherproof enclosure (IP65)
   - ESP32 microcontroller
   - Optical photodetector sensor on GPIO 4
   - OLED graphic screen (SSD1306, 128x64 pixels, I2C)
   - Audio buzzer unit on GPIO 5
   - In-memory ring buffer (50 events maximum)

3. **Node B BLE Multi-Split Gateway (Optional Assembly):**
   - Dual-beam coincidence filter (Top beam on GPIO 4, bottom beam on GPIO 13)
   - Direct Web Bluetooth GATT service
   - Type-C power rail monitor on GPIO 35 (2:1 resistive divider)

4. **Laser Emitter Units (Two Units Minimum):**
   - Collimated 650 nm red laser diode (Class 2 / Class 3R)
   - Optical sight
   - Rechargeable lithium battery pack (18650, 3.7 V)
   - Mounting adapter

5. **Quadrapod Support Stands:**
   - Sand-ballasted PVC base assembly (4 legs, 85 cm span)
   - Vertical extension pole (95 cm height, 90–100 cm sensor center)
   - Enclosure mounting bracket

6. **Operator Software Client:**
   - Progressive Web Application (PWA)
   - Local IndexedDB storage
   - Cloud Firestore synchronization

---

## SECTION 2: SAFETY SUMMARY AND WARNINGS

### 2.1 General Safety
Read all safety instructions before you assemble or operate the equipment.  
Only trained personnel are permitted to operate this equipment.

### 2.2 Laser Radiation Warnings

> [!WARNING]
> DO NOT STARE INTO THE LASER BEAM.  
> DIRECT EYE EXPOSURE CAN CAUSE PERMANENT EYE DAMAGE.  
> CLASS 2 AND CLASS 3R LASERS EMIT VISIBLE RADIATION.

- Never point the laser beam at an athlete, coach, or spectator.
- Always point the laser beam toward the optical sensor aperture.
- Turn off the laser emitter during transport and physical adjustments.
- Put warning signs near the test track during high-velocity tests.

### 2.3 Track and Athlete Safety

> [!WARNING]
> PUT ALL STANDS OUTSIDE THE ATHLETE RUNNING CORRIDOR.  
> COLLISION WITH A TIMING STAND CAN CAUSE INJURY TO THE ATHLETE.

- Keep a minimum lateral clearance of 1.0 meter between the track lane boundary and the quadrapod base.
- Make sure that all cables lie flat on the ground.
- Secure all cables with heavy adhesive tape outside running areas.
- Make sure that the run-off zone behind the finish gate is clear of obstacles for at least 20 meters.

### 2.4 Electrical and Battery Safety

> [!CAUTION]
> USE ONLY APPROVED 5V / 2A BATTERY CHARGERS.  
> INCORRECT CHARGING CAN DAMAGE THE LITHIUM BATTERIES OR CAUSE FIRE.

- Do not expose lithium battery packs to water or high heat (> 50 °C).
- Disconnect battery packs when the equipment is in storage for more than 48 hours.
- If an enclosure shows swelling or leaks fluid, stop operation immediately.
- Discontinue test if Node B Type-C power rail drops below 4.55 V.

---

## SECTION 3: TECHNICAL AND ELECTRICAL SPECIFICATIONS

### 3.1 Timing and Optical Parameters
| Parameter | Value | Tolerance | Standard Reference |
| :--- | :--- | :--- | :--- |
| Timing Measurement Precision | 0.001 seconds (1 millisecond) | ± 0.0005 s | International combine standard |
| Hardware Microcontroller Clock | 240 MHz (Microsecond timer) | ± 1 µs | ESP32 internal timer |
| Optical Sensor Wavelength | 650 nm (Red) / 532 nm (Green) | ± 15 nm | Visible spectrum |
| Maximum Beam Operating Distance | 12.0 meters | Maximum | Single-lane or dual-lane |
| Minimum Beam Interrupt Duration | 5.0 milliseconds | Minimum | Anti-glitch hardware filter |
| Anti-Arm-Swing Coincidence Window | 15.0 milliseconds | Fixed | Dual-beam torso validation |
| False Start Reaction Threshold | 0.100 seconds | Fixed | World Athletics Technical Rule 16.7 |

### 3.2 Electrical and Pinout Specifications
| Component / Signal | ESP32 GPIO Pin | Protocol / Function | Electrical Parameters |
| :--- | :--- | :--- | :--- |
| Node A Optical Sensor | GPIO 4 | Interrupt (`RISING` edge) | Input pull-up, 3.3 V logic |
| Node A Buzzer | GPIO 5 | Active-Low / PWM Piezo | Output, 2 kHz race tone |
| Node A RFID SCK | GPIO 18 | SPI Clock | VSPI bus, 3.3 V |
| Node A RFID MISO | GPIO 19 | SPI Master-In Slave-Out | VSPI bus, 3.3 V |
| Node A RFID MOSI | GPIO 23 | SPI Master-Out Slave-In | VSPI bus, 3.3 V |
| Node A RFID SS (CS) | GPIO 21 | SPI Slave Select | VSPI bus, 3.3 V |
| Node B Optical Sensor | GPIO 4 | Interrupt (`RISING` edge) | Input pull-up, 3.3 V logic |
| Node B Buzzer | GPIO 5 | Active-Low / PWM Piezo | Output, 2.5 kHz finish tone |
| Node B OLED SDA | GPIO 21 | I2C Data | 400 kHz bus, Address 0x3C |
| Node B OLED SCL | GPIO 22 | I2C Clock | 400 kHz bus, Address 0x3C |
| Node B BLE Top Beam | GPIO 4 | Torso Detection (~1.2m height) | Input pull-up |
| Node B BLE Bottom Beam | GPIO 13 | Pelvis Detection (~0.9m height) | Input pull-up |
| Node B BLE VBUS Monitor | GPIO 35 | ADC1 Analog Input | 2:1 divider (100k / 100k), 0–3.3 V |
| Node C Split Sensor | GPIO 4 | Interrupt (`RISING` edge) | Configurable Node ID (2, 3, 4) |

### 3.3 Wireless Communication Parameters
| Protocol | Frequency Band | Maximum Range | Function |
| :--- | :--- | :--- | :--- |
| ESP-NOW Peer-to-Peer | 2.4 GHz ISM | 120 meters (line of sight) | Direct microsecond trigger synchronization |
| Wi-Fi 802.11 b/g/n | 2.4 GHz ISM | 60 meters | Local telemetry and web application link |
| WebSockets (Port 81) | TCP/IP over Wi-Fi | Local network scope | Real-time 50 Hz telemetry broadcast |
| HTTP REST (Port 80) | TCP/IP over Wi-Fi | Local network scope | Remote configuration and mDNS resolution |
| Web Bluetooth (WebBLE) | 2.4 GHz BLE 5.0 | 30 meters | Direct browser wireless GATT connection |

---

## SECTION 4: MECHANICAL AND SENSOR STAND ASSEMBLY

### 4.1 Unpacking and Inspection
1. Remove all components from the transport case.
2. Inspect all enclosures for cracks or loose hardware.
3. Verify that all optical lenses are clean and dry.
4. Verify that all battery packs have a minimum charge of 80 percent.

### 4.2 Quadrapod Stand Assembly
1. Put the 4-leg PVC quadrapod base on level ground next to the running lane.
2. Verify that all four ballast legs contain dry sand.
3. Insert the 95-centimeter vertical riser pole into the central five-way connector.
4. Push down firmly until the riser pole seats completely into the base collar.
5. Repeat steps 1 through 4 for each gate stand.

```
       [ Weatherproof IP65 Enclosure (ESP32 + Sensor) ]
                               ||
                               || 
                    [ 95 cm Vertical Mast ]
                               ||
                               || (Beam Height: 90 - 100 cm)
                               ||
                  +------------++------------+
                 /                            \
        [ Sand Leg ]                        [ Sand Leg ]
        (40 cm span)                        (40 cm span)
                 \                          /
                  +------------------------+
                     Base Span: 85 cm tip-to-tip
```

### 4.3 Gate Placement Along the Track
1. Place the Node A quadrapod stand at the 0-meter launch line.
2. Place the Node B quadrapod stand at the designated finish line (e.g., 40 meters).
3. If you use intermediate splits, place Node C at the intermediate line (e.g., 10 meters).
4. Put the laser emitter on the opposite side of the running lane for each gate.
5. Verify that all quadrapod stands stand at least 1.0 meter outside the lane marking.

### 4.4 Height Adjustment for Center-of-Mass Detection
1. Measure the height from the track surface to the optical sensor aperture.
2. Adjust the riser pole so the optical center sits between 90 cm and 100 cm.
3. Do not place the sensor below 80 cm (prevents false triggering from swinging feet).
4. Do not place the sensor above 115 cm (prevents false triggering from swinging arms).
5. For Node B BLE Dual-Beam stands:
   - Position top beam at 120 cm (torso / sternum level).
   - Position bottom beam at 90 cm (pelvis / hip level).

---

## SECTION 5: OPTICAL AND DUAL-BEAM ALIGNMENT PROCEDURES

### 5.1 Laser Emitter Alignment

> [!CAUTION]
> PROTECT SENSORS FROM DIRECT AMBIENT SUN GLARE.  
> POSITION RECEIVER ENCLOSURES FACING AWAY FROM DIRECT SUNLIGHT WHEN POSSIBLE.

1. Turn the power switch of the laser emitter to ON.
2. Look along the laser alignment sight toward the sensor box across the lane.
3. Adjust the pan and tilt screws until the visible laser dot strikes the target ring on the sensor box.
4. Verify that the laser beam passes directly across the lane perpendicular (90 degrees) to the running line.

### 5.2 Sensor Receiver Alignment Verification
1. Move the laser spot onto the photodetector pinhole.
2. Verify that the internal alignment LED illuminates steady green.
3. If Node A or Node B buzzer mode is set to Alignment (`mode = 2`), the buzzer sounds continuously when the beam breaks.
4. Walk through the beam to verify detection:
   - When your torso breaks the beam, the green LED turns OFF.
   - When your torso clears the beam, the green LED turns ON.

### 5.3 Dual-Beam Coincidence Alignment (Node B BLE)
1. Turn on both top and bottom laser emitters.
2. Strike top photodetector (GPIO 4) with the top laser beam.
3. Strike bottom photodetector (GPIO 13) with the bottom laser beam.
4. Check the SprintGate BLE Modal on the dashboard:
   - Verify `Top Beam (Torso)` indicator shows green `LOCKED`.
   - Verify `Bottom Beam (Hip)` indicator shows green `LOCKED`.
   - Verify `Dual Beam Status` displays `100% ALIGNED - COINCIDENCE ARMED`.
5. If an arm breaks only one beam, the coincidence filter discards the trigger.
6. The finish triggers only when both beams break within a 15-millisecond window.

---

## SECTION 6: NETWORK AND WIRELESS INITIALIZATION (WI-FI, ESP-NOW, WEBBLE)

### 6.1 Wi-Fi Access Point Setup
1. Turn on your mobile Wi-Fi hotspot or portable router.
2. Set the Hotspot SSID to: `Velocity_Lab` (or your configured network SSID).
3. Set the Hotspot Password to: `Vlab@123` (or your configured security key).
4. Verify that the Wi-Fi hotspot operates in the 2.4 GHz band. (ESP32 does not support 5 GHz).

### 6.2 Node Power-Up Sequence
1. Connect the battery cable to Node B (Finish Gate).
2. Observe the OLED screen on Node B:
   - Screen displays `INITIALIZING WIFI...`
   - Screen displays IP address (e.g., `192.168.43.150`) and hostname `finishgate.local`
   - Screen transitions to `STATUS: READY`
3. Connect the battery cable to Node A (Start Gate).
4. Listen for two short confirmation beeps from Node A.
5. Node A registers with mDNS as `startgate.local`.

### 6.3 Web Application Cockpit Connection
1. Open Google Chrome or Microsoft Edge on your control tablet or computer.
2. Navigate to `https://sprintgate-b84db.web.app` (or local development address).
3. Observe the Top Navigation Bar:
   - Verify the official Velocity Lab emerald logo appears clear and complete.
4. Observe the Gate Status Strip below the test mode selector:
   - **NODE A (0m):** Verify badge indicates green `ONLINE` and `CLEAR`.
   - **NODE B (Finish Line):** Verify badge indicates green `ONLINE` and `CLEAR`.
   - **Track Clearance Badge:** Verify indicator displays green `READY TO SEND ATHLETE`.

```
+-----------------------------------------------------------------------------------------+
| [VL LOGO] VELOCITY LAB                 [LIVE TIMING] [ANALYTICS] [ROSTER]  [LOGOUT]     |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
| [ READY TO SEND ATHLETE ]     [ NODE A (0m): ONLINE | CLEAR ]   [ NODE B: ONLINE | CLEAR] |
|                                                                                         |
|                                       00.000                                            |
|                                    ELAPSED TIME                                         |
|                                                                                         |
| [ QUEUED ATHLETE: ALEX RIVERA (BIB #105) ]                                             |
|                                                                                         |
| [ START CADENCE ]   [ TRIGGER GUN ]   [ RESET CLOCK ]   [ FALSE START RECALL ]          |
+-----------------------------------------------------------------------------------------+
```

### 6.4 Direct Web Bluetooth (WebBLE) Connection (Optional Mode)
1. Click the **SprintGate BLE** button on the live cockpit.
2. Click **Scan for Timing Gates** in the modal.
3. Select `SprintGate_Node_B` from the browser Bluetooth pairing prompt.
4. Verify GATT Service connection (`6e400001-b5a3-f393-e0a9-e50e24dcca9e`).
5. Confirm live telemetry stream:
   - Battery rail voltage (5.12 V nominal)
   - Gate-to-Phone BLE RSSI (dBm)
   - Gate-to-Gate ESP-NOW RSSI (dBm)

---

## SECTION 7: OPERATING PROCEDURES AND SPRINT PROTOCOLS

### 7.1 Pre-Flight System Check
Perform this checklist before every timing session:
1. Make sure that all quadrapod stands are stable.
2. Verify that all laser beams align with sensor apertures.
3. Verify that both gate indicators show green `CLEAR` on the dashboard.
4. Verify that the track is dry and clear of debris.
5. Verify that the active athlete is correctly assigned on the dashboard roster.

### 7.2 Athlete Queue Assignment

#### 7.2.1 Manual Selection Method
1. Click the **Active Runner** pill on the dashboard cockpit.
2. Select the target athlete from the roster dropdown list.
3. Verify that the athlete name and bib number appear on the central HUD.

#### 7.2.2 RFID / NFC Tag Scan Method
1. Hold the athlete's RFID wristband or bib tag near the Node A sensor housing.
2. Node A sounds a single high-pitch beep.
3. Node A reads the tag UID and transmits it across the network.
4. The dashboard automatically selects the matched athlete profile.

#### 7.2.3 Athlete QR Code Badge Scan Method
1. Click the **QR Scanner** icon on the top navigation bar.
2. Present the athlete's printed or smartphone QR code badge to the camera.
3. The dashboard decodes the athlete ID and loads the dossier immediately.

---

### 7.3 Testing Protocols Overview
The SprintGate cockpit includes 6 standardized testing protocols:

```
+--------------------------------------------------------------------------------------------------+
| TEST PROTOCOL SELECTOR MENU                                                                      |
+--------------------------------------------------------------------------------------------------+
| 1. [STANDARD SPRINT]  : Straight sprint with intermediate splits (10m, 20m, 30m, 40m, 60m, 100m) |
| 2. [MASS SPRINT HEAT] : Multi-athlete continuous staggered heat (Dynamic FIFO queue management)  |
| 3. [4x10m SHUTTLE]    : World Athletics agility shuttle with 3 turnaround line touches (40m total)|
| 4. [PRO AGILITY 5-10-5: Lateral change-of-direction combine drill (20 yards / 18.3m)            |
| 5. [L-DRILL (3-CONE)] : 3-cone L-shaped figure-eight cutting assessment (30 yards / 27.4m)       |
| 6. [RSA SPRINT SERIES]: Repeated Sprint Ability interval series with anaerobic fatigue decay (%) |
+--------------------------------------------------------------------------------------------------+
```

---

### 7.4 Protocol 1: Standard Sprint Execution

#### 7.4.1 Free Sprint (Start Beam Break Trigger)
1. Select **Standard Sprint** in the protocol menu.
2. Set target distance (e.g., 40 meters).
3. Verify that the Track Clearance pill shows green `READY TO SEND ATHLETE`.
4. Instruct the athlete to assume the starting stance 0.5 meters behind the Node A beam.
5. Instruct the athlete to sprint when ready.
6. The athlete breaks the Node A beam:
   - Node A records timestamp $t_0$ via microsecond hardware interrupt.
   - Node A transmits an ESP-NOW wireless trigger to Node B.
   - The dashboard clock starts counting elapsed time.
   - Track clearance badge switches to amber `HOLD - SPRINT IN PROGRESS`.
7. The athlete breaks the Node B finish beam:
   - Node B records finish timestamp $t_1$.
   - Node B calculates exact sprint duration: $\Delta t = t_1 - t_0$.
   - Node B sounds a finish chime and displays the result on the OLED screen.
   - The dashboard updates immediately with the official sprint time.
8. The dashboard automatically saves the record to the session history.

#### 7.4.2 Sound Cadence and Starting Gun Procedure
1. Click **Cadence Start** on the dashboard cockpit.
2. Node A and the dashboard audio system begin the automated voice sequence:
   - Step 1: *"On your marks..."* (Audio alert).
   - Step 2: *"Set..."* (Audio alert with random hold delay 1.5 s – 2.5 s).
   - Step 3: **Electronic Starting Gun Sound** (Acoustic spike).
3. The starting gun sound triggers the internal zero-clock ($t=0.000\text{s}$).
4. Node A measures the athlete's reaction time:
   - The reaction interval ends when the athlete breaks the launch beam.
   - Reaction time appears on the cockpit display ($T_{\text{react}}$).

---

### 7.5 Protocol 2: Mass Sprint Heat (Continuous FIFO Waves)
1. Select **Mass Sprint Test** in the protocol menu.
2. Instruct Athlete 1 to prepare at Node A.
3. Athlete 1 departs across Node A. Node B pushes timestamp $t_{0,1}$ into the FIFO queue.
4. When Athlete 1 reaches 10 meters, the clearance badge switches to green `READY TO SEND ATHLETE`.
5. Instruct Athlete 2 to depart across Node A. Node B pushes timestamp $t_{0,2}$ into the FIFO queue.
6. As each athlete crosses Node B, the finish time pairs with the oldest start timestamp in the queue:
   $$\Delta T_i = t_{1,i} - \mathbf{Q}_{\text{start}}.\text{pop}()$$
7. The master clock never stops during the heat.
8. Mass sprint testing achieves a throughput of 4 to 5 athletes per minute.

---

### 7.6 Protocol 3: 4x10m Shuttle Run
1. Select **4x10m Shuttle Run** in the protocol menu.
2. Place Node A and Node B at opposite ends of a 10-meter course.
3. Start the athlete from behind the Node A line.
4. The athlete sprints 10 meters, touches the opposite line, and returns:
   - Lap 1 (0 to 10m): Beam break at Node B records Split 1.
   - Lap 2 (10m to 20m): Beam break at Node A records Split 2.
   - Lap 3 (20m to 30m): Beam break at Node B records Split 3.
   - Lap 4 (30m to 40m): Beam break at Node A records final finish time.
5. The audio engine announces intermediate turn splits in real time.

---

### 7.7 Protocol 4 & 5: Pro Agility (5-10-5) and L-Drill (3-Cone)
1. Select **Pro Agility (5-10-5)** or **L-Drill (3-Cone)** in the protocol selector.
2. Position timing gate at the start / finish line.
3. The athlete triggers the gate on initial departure.
4. The athlete completes the prescribed cutting pattern:
   - 5-10-5: 5 yards right, 10 yards left, 5 yards sprint through center gate.
   - L-Drill: 5 yards out, 5 yards back, figure-eight loop around corner cone, sprint through gate.
5. Crossing the gate stops the timer and logs combine agility score.

---

### 7.8 Protocol 6: Repeated Sprint Ability (RSA Series)
1. Select **Repeated Sprint Ability (RSA)** in the protocol selector.
2. Configure number of sprint repetitions (default: 6 reps) and recovery interval (default: 20 seconds).
3. The athlete completes Repetition 1.
4. The dashboard initiates the automated recovery countdown timer.
5. At 5 seconds remaining, the audio engine announces: *"Prepare for next sprint"*.
6. Repeat until all repetitions complete.
7. The dashboard calculates the fatigue decrement percentage ($S_{\text{dec}}$):
   $$S_{\text{dec}} = \left( 1 - \frac{\sum t_{\text{sprint}}}{n \times t_{\text{best}}} \right) \times 100\%$$

---

### 7.9 False Start Detection and Recall Protocol (World Athletics Rule 16.7)

> [!WARNING]
> COMPLY WITH WORLD ATHLETICS TECHNICAL RULE 16.7.  
> REACTION TIMES LESS THAN 0.100 SECONDS ARE PHYSIOLOGICALLY IMPOSSIBLE.  
> DEPARTURES UNDER 0.100 SECONDS CONSTITUTE A FALSE START.

1. If the athlete breaks the launch beam within $t < 0.100\text{s}$ after the gun:
   - Node A triggers an instant hardware fault signal.
   - The system plays the automated secondary recall horn.
   - The dashboard displays a red pulsing alert:
     `WORLD ATHLETICS RULE 16.7: FALSE START DETECTED`
   - The dashboard locks the clock and records `FALSE START (T_react < 100ms)`.
2. The operator orders the athlete to return to the starting line.
3. Click **Reset Gates** to clear the fault and re-arm the track.

```
       GUN FIRES (t = 0.000s)
          |
          |------ 0.000s to 0.099s -------> [ ILLEGAL ZONE: RECALL HORN ACTIVATES ]
          |                                  (World Athletics Rule 16.7 Violation)
          |
          +-----> 0.100s Threshold --------> [ LEGAL ZONE: SPRINT VALIDATED ]
```

---

## SECTION 8: BIOMECHANICAL VIDEO WORKSPACE AND MOTION ANALYSIS

### 8.1 Video Ingestion and Setup
1. Position high-speed camera perpendicular to the sprint lane at 15–20 meters distance.
2. Capture at high frame rates (120 FPS or 240 FPS).
3. In the web dashboard, open the **Biomechanical Video Workspace** tab.
4. Drag and drop the captured `.mp4` video into the video player stage.
5. The workspace initializes the MediaPipe 33-point pose landmark pipeline.

### 8.2 Kinematic Flaw Detection Algorithms
The workspace computes three automated coaching flaw algorithms:

1. **Overstriding and Touchdown Braking:**
   - Detects frame of initial ground contact ($t_{\text{touchdown}}$).
   - Measures foot horizontal offset relative to hip center of mass ($\Delta X_{\text{cm}}$).
   - Measures touchdown shin angle ($\theta_{\text{shin}}$).
   - **Flaw Flag:** $\Delta X_{\text{cm}} > 5\text{ cm}$ AND $\theta_{\text{shin}} > +8^\circ$.
   - **Coaching Cue:** *"Strike backward under your hips! Think claw-back to contact the track directly below your center of mass."*

2. **Excessive Backside Heel Recovery ("Butt-Kicking"):**
   - Measures knee flexion angle ($\phi_{\text{knee}}$) during swing phase behind hip.
   - **Flaw Flag:** $\phi_{\text{knee}} > 140^\circ$ posterior to hip.
   - **Coaching Cue:** *"Step over the opposite knee! Pull your toe up immediately at toe-off and punch the knee forward."*

3. **Premature Torso Uprighting:**
   - Evaluates trunk lean angle during first 1.8 seconds (acceleration drive phase).
   - **Flaw Flag:** Trunk angle drops below $11^\circ$ before $1.5\text{s}$.
   - **Coaching Cue:** *"Stay patient in the drive! Keep eyes down and let your torso rise naturally 3 degrees per stride."*

### 8.3 Chronophotography Strobe Motion Visualization
1. In the Biomechanical Workspace, click **Strobe Motion**.
2. Select stride phase range (e.g., 6, 8, 10, or 12 phases).
3. The engine renders chronological skeletal overlays using the 12-phase color palette:
   - Phase 1: Electric Cyan (`#00F0FF`)
   - Phase 2: Emerald Accent (`#00D084`)
   - Phase 3: Teal Green (`#10B981`)
   - Phase 4: Neon Lime (`#84CC16`)
   - Phase 5: Amber Gold (`#F59E0B`)
   - Phase 6: Vibrant Orange (`#F97316`)
4. Click **Download Strobe Image** or **Export Strobe PDF** for coaching review.

### 8.4 Side-by-Side Comparison Player
1. Click **Compare Runs** in the workspace.
2. Select Run A (e.g., Baseline PR) and Run B (Current Trial).
3. Use the synchronized dual scrubber to analyze kinematic differences at touchdown.

---

## SECTION 9: PERIPHERAL SENSORS AND ENVIRONMENTAL AUDIT

### 9.1 Bluetooth Low Energy (BLE) Heart Rate Integration
1. Click the **Heart Rate** button on the live cockpit.
2. Turn on your Bluetooth chest strap or armband (Polar H10, Garmin HRM-Pro, Wahoo TICKR).
3. Click **Connect Heart Rate Monitor**.
4. Confirm real-time metrics:
   - Live Heart Rate (BPM)
   - Dynamic 5-Zone Gauge (Recovery, Aerobic, Tempo, Threshold, Anaerobic Peak)
   - RR-Intervals for Heart Rate Variability (HRV)
5. Heart rate data records synchronously with sprint start and finish timestamps.

### 9.2 Meteorological Wind Engine (World Athletics Rule 163.8)
1. Open the **Wind Gauge** controller on the top cockpit strip.
2. The engine fetches real-time meteorological wind speed and direction:
   - Sources: Open-Meteo High-Resolution Model, DWD ICON, wttr.in.
   - Automatic GPS reverse geocoding identifies venue locality.
3. **World Athletics Legal Limit:** $\le +2.0\text{ m/s}$ tailwind.
4. If wind exceeds $+2.0\text{ m/s}$, the cockpit flags: `WIND ASSISTED (> +2.0 m/s)`.
5. Net wind component automatically applies to the aerodynamic drag equations in the FVP engine.

### 9.3 Stadium Jumbotron and Spectator Scoreboard
1. Click the **Spectator Display** button on the cockpit top bar.
2. Open fullscreen on an external TV, HDMI monitor, or stadium LED board.
3. Displays high-contrast running clock, active athlete photo, country flag, and sector records.

---

## SECTION 10: FAULT ISOLATION, DIAGNOSTIC CODES, AND MAINTENANCE

### 10.1 Diagnostic Fault Codes
| Code / Status | Meaning | System Behavior | Corrective Action |
| :--- | :--- | :--- | :--- |
| `ERR_BEAM_BREAK` | Optical beam broken before arming. | Gate refuses arm command. | Re-align laser dot onto sensor aperture. |
| `ERR_LOW_VBUS` | Type-C power rail drops below 4.55 V. | Warning badge displayed on BLE HUD. | Replace or recharge USB-C power bank. |
| `ERR_FIFO_OVERFLOW`| More than 10 runners queued in memory. | Oldest start dropped. | Send runners at minimum 2.0s intervals. |
| `ERR_WEBSOCKET_LOST`| Local Wi-Fi link interrupted. | In-memory ring buffer saves events. | Reconnect client to `Velocity_Lab` hotspot. |
| `ERR_FALSE_START` | Departure under 0.100s after gun. | Recall horn sounds, clock locked. | Recall runner and reset gate. |

### 10.2 Troubleshooting Guide
| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| Node A or Node B indicator shows red `OFFLINE`. | Battery discharged or power disconnected. | Connect battery charger. Verify voltage $> 3.7\text{ V}$. |
| Node indicator shows yellow `RETRY (n)`. | Wi-Fi signal weak or disconnected. | Move Wi-Fi hotspot closer to timing gates. |
| Node indicator shows green `ONLINE`, but beam remains `BLOCKED`. | Laser misaligned or dirty lens. | Clean lens with microfiber cloth. Re-align laser beam. |
| Sensor triggers repeatedly with no runner present. | Strong sun glare into sensor tube. | Turn sensor enclosure away from direct sun. Install sun hood. |
| Clock does not start when athlete crosses Node A. | Beam interrupted before start. | Verify alignment LED is solid green before runner departs. |
| Dashboard clock runs, but finish gate does not stop clock. | Finish laser misaligned. | Re-align Node B finish laser. Test beam manually with hand swipe. |
| False start alert triggers during a valid start. | Athlete foot or arm broke beam early. | Instruct athlete to stand 0.5 m behind beam prior to the gun. |
| Web dashboard does not open in browser. | Computer disconnected from local Wi-Fi. | Connect computer to `Velocity_Lab` Wi-Fi hotspot network. |

### 10.3 Post-Session Maintenance and Storage
1. Disconnect all battery packs from Node A, Node B, and laser emitters.
2. Clean all sensor apertures and laser optics with a dry microfiber cloth.
3. Wipe down PVC quadrapod stands with a damp cloth to remove track dirt.
4. Store battery packs in a cool, dry room (15 °C to 25 °C) at 50 to 60 percent charge.
5. Pack all enclosures, cables, and optical units into the weatherproof hard-shell case.

---

**END OF TECHNICAL SYSTEM OPERATOR MANUAL**  
*Velocity Lab — Engineering Human Speed*  
*Document Ref: SG-MAN-STE100-001 (Rev 2.2)*  
