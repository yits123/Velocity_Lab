/*
 * Copyright (C) 2026 Velocity Lab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Velocity Lab - ESP32 Node B Headless Timing Gate Mock Server
 * 
 * Simulates ESP32 Timing Gate (Node B) WebSocket server on port 81 
 * and HTTP configuration endpoints on port 80.
 * 
 * Usage:
 *   node simulate_node_b.js
 * 
 * Interactive Keys:
 *   [s] - Trigger Start Beam Break (Node A / Start Gate)
 *   [1] - Trigger 10m Split
 *   [2] - Trigger 20m Split
 *   [f] - Trigger Finish Beam Break (Node B / Finish Gate)
 *   [a] - Run Automated 40m Sprint Scenario
 *   [r] - Trigger RFID Check-in Badge Tap
 *   [x] - Trigger False Start (breaks beam during Set)
 *   [l] - Toggle Laser LDR Alignment (Aligned <-> Broken)
 *   [q] - Quit
 */

const http = require('http');
const readline = require('readline');

const HTTP_PORT = 8080; // Default fallback if 80 requires admin; can be set via env
const WS_PORT = 81;

// Minimal zero-dependency WebSocket Server implementation
const crypto = require('crypto');

let clients = [];
let activeRunners = 0;
let ldrStatus = 0; // 0 = clear/aligned, 1 = beam broken
let lastTime = 0.0;
let lastReactionTime = 155;
let lastSplitTime = 0.0;
let lastSplitNodeId = 101;
let lastRfidUid = "B48F9A12";
let newResult = false;
let newSplit = false;
let newRfidScan = false;
let newGunFired = false;
let runStartTime = 0;

function broadcastState() {
  const payload = JSON.stringify({
    ldr_status: ldrStatus,
    active_runners: activeRunners,
    new_result: newResult,
    time: parseFloat(lastTime.toFixed(3)),
    reaction_time: lastReactionTime,
    new_split: newSplit,
    split_node: lastSplitNodeId,
    rfid_scan: newRfidScan ? lastRfidUid : null,
    gun_fired: newGunFired,
    split_time: parseFloat(lastSplitTime.toFixed(3))
  });

  clients.forEach(client => {
    if (client.writable) {
      sendWsFrame(client, payload);
    }
  });

  if (newResult) newResult = false;
  if (newSplit) newSplit = false;
  if (newRfidScan) newRfidScan = false;
  if (newGunFired) newGunFired = false;
}

function sendWsFrame(socket, text) {
  try {
    const payload = Buffer.from(text);
    const length = payload.length;
    let header;

    if (length <= 125) {
      header = Buffer.from([0x81, length]);
    } else if (length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    socket.write(Buffer.concat([header, payload]));
  } catch (err) {
    // client disconnected
  }
}

// WebSocket Server (Port 81)
const wsHttpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Velocity Lab ESP32 WebSocket Endpoint on port 81\n');
});

wsHttpServer.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }
  const acceptKey = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];
  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
  clients.push(socket);
  console.log(`[WS] Client connected. Total active clients: ${clients.length}`);

  socket.on('data', (buffer) => {
    try {
      if (buffer.length >= 6) {
        const isMasked = (buffer[1] & 0x80) !== 0;
        let payloadLen = buffer[1] & 0x7F;
        let maskStart = 2;
        if (payloadLen === 126) maskStart = 4;
        else if (payloadLen === 127) maskStart = 10;
        
        if (isMasked && buffer.length >= maskStart + 4) {
          const mask = buffer.slice(maskStart, maskStart + 4);
          const rawData = buffer.slice(maskStart + 4);
          const decoded = Buffer.alloc(rawData.length);
          for (let i = 0; i < rawData.length; i++) {
            decoded[i] = rawData[i] ^ mask[i % 4];
          }
          const text = decoded.toString('utf8');
          if (text.includes('ping')) {
            sendWsFrame(socket, JSON.stringify({ type: 'pong', ldr_status: ldrStatus, active_runners: activeRunners }));
          }
        }
      }
    } catch (e) {}
  });

  socket.on('close', () => {
    clients = clients.filter(c => c !== socket);
    console.log(`[WS] Client disconnected. Total active clients: ${clients.length}`);
  });

  socket.on('error', () => {
    clients = clients.filter(c => c !== socket);
  });

  // Send initial state immediately
  broadcastState();
});

// Periodic state broadcast (every 100ms like firmware)
setInterval(broadcastState, 100);

// HTTP Server for Gate control endpoints (/reset, /gun, /config)
const httpServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url || '/';
  if (url === '/config' || url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: "ok", node: "B", active_runners: activeRunners, ldr_status: ldrStatus }));
  } else if (url === '/reset') {
    activeRunners = 0;
    ldrStatus = 0;
    console.log('[HTTP] /reset received -> cleared active runners');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('RESET OK\n');
  } else if (url === '/gun') {
    newGunFired = true;
    console.log('[HTTP] /gun received -> gun fired, awaiting athlete laser beam break');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('GUN FIRED OK\n');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Velocity Lab Node B Simulated API\n');
  }
});

// Start listening
wsHttpServer.listen(WS_PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Velocity Lab - ESP32 Timing Gate Simulator running!`);
  console.log(`⚡ WebSocket Server: ws://localhost:${WS_PORT}/`);
  console.log(`📡 Point web app Node B IP to: localhost or 127.0.0.1`);
  console.log(`=======================================================`);
});

const HTTP_PORT_ACTUAL = process.getuid && process.getuid() !== 0 ? 8080 : 80;
httpServer.listen(HTTP_PORT_ACTUAL, () => {
  console.log(`🌐 HTTP API Server:   http://localhost:${HTTP_PORT_ACTUAL}/`);
  printHelp();
}).on('error', (err) => {
  if (err.code === 'EACCES') {
    httpServer.listen(8080, () => {
      console.log(`🌐 HTTP API Server running on port 8080 (fallback for non-root)`);
      printHelp();
    });
  }
});

function printHelp() {
  console.log(`\nInteractive Control Deck:`);
  console.log(`  [s] - Trip Start Gate (Laser beam break)`);
  console.log(`  [1] - Trip 10m Split (10m laser break)`);
  console.log(`  [2] - Trip 20m Split (20m laser break)`);
  console.log(`  [f] - Trip Finish Gate (Final beam break)`);
  console.log(`  [a] - Automated 40m Sprint Run (4.85s)`);
  console.log(`  [4] - Automated 4x10m Shuttle Run (4 legs with >=2.0s physics)`);
  console.log(`  [r] - Tap Athlete RFID Badge`);
  console.log(`  [x] - Simulate False Start`);
  console.log(`  [l] - Toggle Laser LDR Alignment`);
  console.log(`  [q] - Exit Simulator\n`);
}

// Console input handler
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') process.exit();

  switch (str) {
    case 's':
      activeRunners = 1;
      runStartTime = Date.now();
      lastReactionTime = 148 + Math.floor(Math.random() * 25);
      console.log(`[SIM] START GATE (NODE A) TRIPPED! Reaction Time: ${lastReactionTime}ms | Active Runners: 1`);
      break;

    case 'f':
      ldrStatus = 1;
      setTimeout(() => { ldrStatus = 0; }, 300);
      if (activeRunners > 0) {
        lastTime = (Date.now() - runStartTime) / 1000;
        newResult = true;
        activeRunners = 0;
        console.log(`[SIM] FINISH GATE (NODE B) TRIPPED! Final Time: ${lastTime.toFixed(3)}s`);
      } else {
        console.log(`[SIM] FAULT: Finish Gate (Node B) broken while active_runners == 0 (Runner never broke Node A start beam)!`);
      }
      break;

    case 'a':
      console.log(`[SIM] >>> Starting Automated 40m Sprint Scenario...`);
      newGunFired = true;
      activeRunners = 1;
      runStartTime = Date.now();
      lastReactionTime = 152;
      console.log(`  -> Gun Fired! Runner reacts in ${lastReactionTime}ms`);

      setTimeout(() => {
        lastSplitTime = 1.76;
        newSplit = true;
        lastSplitNodeId = 101;
        console.log(`  -> 10m Split: 1.760s`);
      }, 1760);

      setTimeout(() => {
        lastSplitTime = 2.92;
        newSplit = true;
        lastSplitNodeId = 102;
        console.log(`  -> 20m Split: 2.920s`);
      }, 2920);

      setTimeout(() => {
        lastSplitTime = 4.01;
        newSplit = true;
        lastSplitNodeId = 103;
        console.log(`  -> 30m Split: 4.010s`);
      }, 4010);

      setTimeout(() => {
        lastTime = 4.885;
        newResult = true;
        activeRunners = 0;
        console.log(`  -> FINISH: 4.885s! Complete.`);
      }, 4885);
      break;

    case '4':
      console.log(`[SIM] >>> Starting Automated 4x10m Shuttle Run Scenario...`);
      newGunFired = true;
      activeRunners = 1;
      runStartTime = Date.now();
      lastReactionTime = 160;
      console.log(`  -> Gun Fired / Start Gate Tripped! (0.000s)`);

      // Leg 1: 10m sprint to Turn 1 (picks up block 1)
      setTimeout(() => {
        lastSplitTime = 2.450;
        newSplit = true;
        lastSplitNodeId = 101;
        console.log(`  -> Leg 1 (Turn 1 @ 10m line): 2.450s (Leg: 2.450s)`);
      }, 2450);

      // Leg 2: 10m sprint back to Start line (drops block 1)
      setTimeout(() => {
        lastSplitTime = 5.100;
        newSplit = true;
        lastSplitNodeId = 102;
        console.log(`  -> Leg 2 (Turn 2 @ Start line): 5.100s (Leg: 2.650s)`);
      }, 5100);

      // Leg 3: 10m sprint to Turn 3 (picks up block 2)
      setTimeout(() => {
        lastSplitTime = 7.650;
        newSplit = true;
        lastSplitNodeId = 103;
        console.log(`  -> Leg 3 (Turn 3 @ 10m line): 7.650s (Leg: 2.550s)`);
      }, 7650);

      // Leg 4: 10m sprint through Start line (FINISH!)
      setTimeout(() => {
        lastTime = 9.920;
        newResult = true;
        activeRunners = 0;
        console.log(`  -> Leg 4 (FINISH @ Start line): 9.920s (Leg: 2.270s)! Test Complete.`);
      }, 9920);
      break;

    case 'r':
      newRfidScan = true;
      lastRfidUid = "B48F9A" + Math.floor(10 + Math.random() * 89);
      console.log(`[SIM] RFID BADGE SCANNED: UID [${lastRfidUid}]`);
      break;

    case 'x':
      activeRunners = 1;
      console.log(`[SIM] FALSE START TRIGGERED! (Beam broken prematurely)`);
      break;

    case 'l':
      ldrStatus = ldrStatus === 0 ? 1 : 0;
      console.log(`[SIM] Laser alignment toggled: ${ldrStatus === 1 ? 'BEAM BLOCKED / BROKEN' : 'BEAM ALIGNED & CLEAR'}`);
      break;

    case 'q':
      console.log('Exiting simulator.');
      process.exit();
      break;
  }
});
