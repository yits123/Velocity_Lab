# SprintGate - Automated Evaluation System

SprintGate is a production-grade automated athletic timing and biometric evaluation platform utilizing a Headless Dual-Fire architecture.

## Architecture (Headless Dual-Fire)

The system consists of two physical IoT nodes and a Progressive Web App (PWA) client, connecting via a central mobile hotspot.

1. **Node A (Start Gate - 0m Line):** ESP32 with LDR module. Broadcasts departure via ESP-NOW (primary) and HTTP (secondary).
2. **Node B (Finish Gate - 50m Line):** ESP32 with LDR module. Receives triggers, computes sprint times, and exposes APIs for data.
3. **Web Dashboard (React PWA):** Admin hub for configurations, live alignment, normative grading, TTS, CSV export, and Firebase logging.

## Setup
Run `npm install && npm run dev` inside `web_app/` for frontend setup.
Flash `node_a_headless.ino` to the start gate ESP32 and `node_b_headless.ino` to the finish gate ESP32.
