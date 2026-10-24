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

import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  Usb, 
  Bluetooth, 
  Radio, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Search, 
  Sliders, 
  Activity, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import webSerialSprintGateService from '../utils/webSerialSprintGateService';
import bleSprintGateService from '../utils/bleSprintGateService';

export default function GateConnectionModal({
  isOpen,
  onClose,
  nodeA,
  setNodeA,
  nodeB,
  setNodeB,
  statusA = { online: false, beam_broken: false },
  statusB = { online: false, beam_broken: false, reconnecting: false, reconnectAttempts: 0 },
  isBleConnected = false,
  isSerialConnected = false,
  serialPortName = '',
  onScanHotspot,
  isScanningHotspot = false,
  scanProgress = '',
  onManualReconnect
}) {
  const [activeTab, setActiveTab] = useState('hotspot'); // 'hotspot' | 'usbc' | 'bluetooth' | 'help'
  const [tempIpB, setTempIpB] = useState(nodeB || '');
  const [tempIpA, setTempIpA] = useState(nodeA || '');
  const [copiedMac, setCopiedMac] = useState(false);
  const [testPingStatus, setTestPingStatus] = useState(null);
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    setTempIpB(nodeB || '');
  }, [nodeB]);

  useEffect(() => {
    setTempIpA(nodeA || '');
  }, [nodeA]);

  if (!isOpen) return null;

  const handleSaveIps = (e) => {
    e?.preventDefault();
    const cleanB = tempIpB.trim();
    const cleanA = tempIpA.trim();
    if (cleanB) {
      setNodeB(cleanB);
      localStorage.setItem('sprintgate_node_b_ip', cleanB);
    }
    if (cleanA) {
      setNodeA(cleanA);
      localStorage.setItem('sprintgate_node_a_ip', cleanA);
    }
    if (onManualReconnect) onManualReconnect();
  };

  const handleConnectUsb = async () => {
    try {
      await webSerialSprintGateService.connect();
    } catch (err) {
      alert("USB Connection: " + (err.message || err));
    }
  };

  const handleDisconnectUsb = async () => {
    await webSerialSprintGateService.disconnect();
  };

  const handleConnectBle = async () => {
    try {
      await bleSprintGateService.connect();
    } catch (err) {
      alert("Bluetooth Connection: " + (err.message || err));
    }
  };

  const handleDisconnectBle = async () => {
    await bleSprintGateService.disconnect();
  };

  const handleTestPing = async () => {
    setIsPinging(true);
    setTestPingStatus(null);
    const target = tempIpB.trim() || nodeB || '192.168.43.15';
    const cleanHost = target.replace(/^(https?:\/\/)/, '').replace(/^(wss?:\/\/)/, '').split('/')[0];
    const pingUrl = `http://${cleanHost}/data`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(pingUrl, { signal: controller.signal, mode: 'cors' });
      clearTimeout(timeoutId);
      if (res.ok) {
        setTestPingStatus({ success: true, msg: `Online! Response received from ${cleanHost}` });
      } else {
        setTestPingStatus({ success: false, msg: `HTTP status ${res.status} from ${cleanHost}` });
      }
    } catch (err) {
      setTestPingStatus({ 
        success: false, 
        msg: `Unable to reach ${pingUrl}. Make sure device is on the same hotspot and IP is correct.` 
      });
    } finally {
      setIsPinging(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedMac(true);
    setTimeout(() => setCopiedMac(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  SprintGate Hardware Connection Hub
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 uppercase">
                  Multi-Modal
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Connect via Wi-Fi Hotspot, Direct USB-C Cable, or Web Bluetooth
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-gray-400 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Multi-Link Status Ribbon */}
        <div className="bg-slate-100/90 dark:bg-slate-800/90 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              statusB?.online || isSerialConnected || isBleConnected 
                ? 'bg-emerald-500 animate-pulse' 
                : 'bg-rose-500'
            }`} />
            <span className="font-bold text-slate-700 dark:text-gray-200">
              Active Gate Link:
            </span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase">
              {isSerialConnected ? 'USB-C Direct (0ms)' : isBleConnected ? 'Web Bluetooth (BLE)' : statusB?.online ? 'Wi-Fi Hotspot (WS)' : 'OFFLINE (Connecting)'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Start Gate (0m): <strong className={statusA?.online ? 'text-emerald-600 dark:text-emerald-400' : statusA?.timedOut ? 'text-rose-500' : 'text-slate-400'}>{statusA?.online ? 'ONLINE' : statusA?.timedOut ? 'TIMED OUT' : 'OFF'}</strong></span>
            <span>•</span>
            <span>Finish Gate: <strong className={statusB?.online || isSerialConnected || isBleConnected ? 'text-emerald-600 dark:text-emerald-400' : statusB?.timedOut ? 'text-rose-500 font-bold' : 'text-amber-500'}>
              {isSerialConnected ? 'USB-C' : isBleConnected ? 'BLE' : statusB?.online ? 'ONLINE' : statusB?.timedOut ? 'TIMED OUT (PAUSED)' : statusB?.reconnecting ? `RETRY (${statusB?.reconnectAttempts || 1})` : 'OFF'}
            </strong></span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 shrink-0 text-xs font-bold text-center bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('hotspot')}
            className={`py-3 flex items-center justify-center gap-1.5 transition border-b-2 ${
              activeTab === 'hotspot' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <Wifi size={14} />
            <span>1. Wi-Fi Hotspot</span>
          </button>
          <button
            onClick={() => setActiveTab('usbc')}
            className={`py-3 flex items-center justify-center gap-1.5 transition border-b-2 ${
              activeTab === 'usbc' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <Usb size={14} />
            <span>2. USB-C Cable</span>
          </button>
          <button
            onClick={() => setActiveTab('bluetooth')}
            className={`py-3 flex items-center justify-center gap-1.5 transition border-b-2 ${
              activeTab === 'bluetooth' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <Bluetooth size={14} />
            <span>3. Bluetooth</span>
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`py-3 flex items-center justify-center gap-1.5 transition border-b-2 ${
              activeTab === 'help' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <HelpCircle size={14} />
            <span>4. Hotspot Guide</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4">

          {/* 1-Minute Connection Timeout Alert Banner */}
          {(statusB?.timedOut || statusA?.timedOut) && !isSerialConnected && !isBleConnected && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-black uppercase tracking-wider">
                    Connection Timed Out (1-Minute Limit Reached)
                  </div>
                  <div className="text-xs mt-0.5 opacity-90 leading-relaxed">
                    Auto-retry has stopped to conserve battery. Verify your phone hotspot is turned on (<code className="font-mono font-bold">Velocity_Lab / Vlab@123</code>), check ESP32 power, and tap Retry to reconnect.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onManualReconnect}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw size={14} />
                <span>Retry Connection</span>
              </button>
            </div>
          )}
          
          {/* TAB 1: WI-FI HOTSPOT & IP DISCOVERY */}
          {activeTab === 'hotspot' && (
            <div className="space-y-4">
              {/* Hotspot Device Detection Card */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Connected Hotspot ESP32 Detected
                    </span>
                    <span className="text-[10px] font-mono bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                      MAC: d4:e9:f4:e1:ed:94
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Your phone hotspot has assigned this ESP an IP (typically <code className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded">192.168.43.x</code>). Enter the IP below or click Auto-Scan.
                  </p>
                </div>
                
                <button
                  onClick={onScanHotspot}
                  disabled={isScanningHotspot}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isScanningHotspot ? "animate-spin" : ""} />
                  <span>{isScanningHotspot ? (scanProgress || "Scanning Subnet...") : "Auto-Scan Hotspot"}</span>
                </button>
              </div>

              {/* IP Input Form */}
              <form onSubmit={handleSaveIps} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    Gate IP Addresses
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Port 81 (WS) &amp; Port 80 (HTTP)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Node B Finish Gate (Master)
                    </label>
                    <input
                      type="text"
                      value={tempIpB}
                      onChange={e => setTempIpB(e.target.value)}
                      placeholder="e.g. 192.168.43.15 or finishgate.local"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Node A Start Gate (0m)
                    </label>
                    <input
                      type="text"
                      value={tempIpA}
                      onChange={e => setTempIpA(e.target.value)}
                      placeholder="e.g. 192.168.43.16 or startgate.local"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestPing}
                      disabled={isPinging}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1.5"
                    >
                      <Activity size={13} className={isPinging ? "animate-spin" : ""} />
                      <span>{isPinging ? "Testing..." : "Test Ping Node B"}</span>
                    </button>
                    {testPingStatus && (
                      <span className={`text-[11px] font-mono font-bold ${testPingStatus.success ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {testPingStatus.msg}
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-sm"
                  >
                    Save &amp; Connect Wi-Fi
                  </button>
                </div>
              </form>

              {/* Quick Subnet Helper Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Quick Subnet Presets (Click to apply):
                </span>
                <div className="flex flex-wrap gap-2">
                  {['192.168.43.', '172.20.10.', '192.168.1.', '192.168.0.', '192.168.4.1'].map(prefix => (
                    <button
                      key={prefix}
                      type="button"
                      onClick={() => {
                        const targetIp = prefix.endsWith('.1') ? prefix : `${prefix}15`;
                        setTempIpB(targetIp);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 transition"
                    >
                      {prefix.endsWith('.1') ? 'ESP SoftAP (192.168.4.1)' : `${prefix}x`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setTempIpB('finishgate.local');
                      setTempIpA('startgate.local');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 transition"
                  >
                    mDNS (.local)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT USB-C (WEB SERIAL) */}
          {activeTab === 'usbc' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Usb size={18} className="text-emerald-500" />
                    <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Direct USB-C Cable Link
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                      Zero-Latency • 115200 Baud
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Connect the ESP32 directly to your Laptop or Android phone via a USB-C data cable. Operates without Wi-Fi or Bluetooth!
                  </p>
                </div>

                {isSerialConnected ? (
                  <button
                    onClick={handleDisconnectUsb}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition shadow-sm"
                  >
                    Disconnect USB-C
                  </button>
                ) : (
                  <button
                    onClick={handleConnectUsb}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-2 shrink-0"
                  >
                    <Usb size={14} />
                    <span>Connect USB-C Port</span>
                  </button>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-500">Hardware Status:</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {isSerialConnected ? `Connected (${serialPortName || 'COM Port'})` : 'No USB-C Port Selected'}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-500">Supported Devices:</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    ESP32-WROOM, ESP32-S3, NodeMCU, CP2102, CH340, FTDI
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-500">Browser Compatibility:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    Google Chrome, Microsoft Edge, Opera (Desktop &amp; Android)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIRECT WEB BLUETOOTH (WEBBLE) */}
          {activeTab === 'bluetooth' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bluetooth size={18} className="text-sky-500" />
                    <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Direct Web Bluetooth (WebBLE)
                    </span>
                    <span className="text-[10px] font-mono bg-sky-500/20 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full font-bold">
                      Wireless BLE GATT
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Pairs wirelessly with the ESP32 SprintGate BLE firmware without Wi-Fi passwords or router configuration.
                  </p>
                </div>

                {isBleConnected ? (
                  <button
                    onClick={handleDisconnectBle}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition shadow-sm"
                  >
                    Disconnect BLE
                  </button>
                ) : (
                  <button
                    onClick={handleConnectBle}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-2 shrink-0"
                  >
                    <Bluetooth size={14} />
                    <span>Pair Bluetooth Gate</span>
                  </button>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-500">BLE Connection Status:</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {isBleConnected ? 'Connected (GATT Stream Active)' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-500">Advertised Service UUID:</span>
                  <span className="font-bold text-slate-800 dark:text-white text-[11px]">
                    6e400001-b5a3-f393-e0a9-e50e24dcca9e
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HOTSPOT SETUP & TROUBLESHOOTING GUIDE */}
          {activeTab === 'help' && (
            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  How to Connect on Mobile Hotspot (Step-by-Step):
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 pl-1">
                  <li><strong>Turn on your Phone Hotspot:</strong> Set SSID to <code className="font-mono bg-white dark:bg-slate-900 px-1 py-0.5 rounded font-bold">Velocity_Lab</code> and Password to <code className="font-mono bg-white dark:bg-slate-900 px-1 py-0.5 rounded font-bold">Vlab@123</code> (or adjust in your ESP firmware).</li>
                  <li><strong>Check Connected Devices:</strong> Open your phone's Hotspot settings screen. Look for the connected device with MAC <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">d4:e9:f4:e1:ed:94</code>.</li>
                  <li><strong>Note the IP Address:</strong> Tap the device in your phone's list to view its IP (e.g. <code className="font-mono font-bold">192.168.43.15</code>).</li>
                  <li><strong>Enter IP or Click Auto-Scan:</strong> Switch to Tab 1 above, enter that IP into Node B, and click Save.</li>
                  <li><strong>Direct Cable Alternative:</strong> If Wi-Fi is busy, plug a USB-C cable directly from ESP32 to your phone/laptop and click "Connect USB-C" in Tab 2 for 0ms lag!</li>
                </ol>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs font-mono">
                <span className="text-slate-500">Your ESP32 MAC Address:</span>
                <button
                  onClick={() => copyToClipboard('d4:e9:f4:e1:ed:94')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold transition"
                >
                  {copiedMac ? <Check size={12} /> : <Copy size={12} />}
                  <span>d4:e9:f4:e1:ed:94</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            SprintGate Universal I/O Gateway v2.4
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-black font-bold text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
