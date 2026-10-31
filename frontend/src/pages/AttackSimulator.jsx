import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Play, RefreshCcw, ShieldAlert, Sparkles } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';
import { createAlertsSocket } from '../lib/socket';

const severityStyle = {
  CRITICAL: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  HIGH: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
  MEDIUM: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  LOW: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
};

const severityDot = {
  CRITICAL: 'bg-rose-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-emerald-400',
};

function formatPercent(value) {
  return `${Math.max(0, Math.min(100, value || 0))}%`;
}

export default function AttackSimulator() {
  const [currentAttack, setCurrentAttack] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [terminalLines, setTerminalLines] = useState([]);
  const [status, setStatus] = useState('Ready to simulate');

  const riskScore = currentAttack?.risk_score || 0;
  const statusTone = useMemo(() => {
    if (riskScore >= 85) return 'text-rose-300';
    if (riskScore >= 60) return 'text-orange-300';
    if (riskScore >= 35) return 'text-amber-200';
    return 'text-emerald-200';
  }, [riskScore]);

  const pushEvent = (event) => {
    const key = `${event.timestamp}-${event.attack}-${event.target}`;
    setHistory((prev) => {
      const filtered = prev.filter((item) => `${item.timestamp}-${item.attack}-${item.target}` !== key);
      return [event, ...filtered].slice(0, 8);
    });
    setCurrentAttack(event);
    setStatus(`${event.attack} ${event.status.toLowerCase()} at ${event.target}`);
  };

  async function simulateAttack() {
    setLoading(true);
    setStatus('Simulating attack...');
    try {
      const { data } = await api.get('/simulate-attack');
      pushEvent(data);
      setTerminalLines([]);
    } catch (error) {
      setStatus('Simulation failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentAttack?.terminal_logs?.length) return undefined;

    setTerminalLines([]);
    let index = 0;
    const timer = window.setInterval(() => {
      setTerminalLines((prev) => [...prev, currentAttack.terminal_logs[index]]);
      index += 1;
      if (index >= currentAttack.terminal_logs.length) {
        window.clearInterval(timer);
      }
    }, 420);

    return () => window.clearInterval(timer);
  }, [currentAttack?.timestamp]);

  useEffect(() => {
    const socket = createAlertsSocket((evt) => {
      if (evt?.channel === 'attack_simulation' && evt.payload) {
        pushEvent(evt.payload);
      }
    });

    return () => {
      if (typeof socket.safeClose === 'function') {
        socket.safeClose();
      } else {
        socket.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!autoMode) return undefined;
    const timer = window.setInterval(() => {
      void simulateAttack();
    }, 7000);
    return () => window.clearInterval(timer);
  }, [autoMode]);

  return (
    <AppShell>
      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 border border-cyan/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/30">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">AI Attack Simulator</p>
              <h1 className="font-display text-3xl md:text-4xl text-cyan mt-2">Live cyber attack demo engine</h1>
              <p className="text-white/65 mt-2 max-w-2xl">Generate realistic attack scenarios, stream them to the SOC, and get instant AI analysis with mitigation guidance.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={simulateAttack} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded bg-warning text-black font-semibold shadow-lg shadow-warning/20">
                <Play size={16} />
                {loading ? 'Simulating...' : 'Simulate Attack'}
              </button>
              <button onClick={() => setAutoMode((value) => !value)} className={`inline-flex items-center gap-2 px-4 py-2 rounded border ${autoMode ? 'border-lime-400 text-lime-200 bg-lime-400/10' : 'border-cyan/30 text-cyan bg-cyan/5'}`}>
                <RefreshCcw size={16} className={autoMode ? 'animate-spin' : ''} />
                {autoMode ? 'Auto Mode On' : 'Auto-Refresh Mode'}
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 xl:col-span-2 border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">Live simulation</p>
                <h2 className="font-display text-2xl text-white mt-1">{currentAttack?.attack || 'Awaiting first attack'}</h2>
                <p className="text-white/60 mt-1">{status}</p>
              </div>
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${severityStyle[currentAttack?.severity] || 'border-white/10 bg-white/5 text-white/60'}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${severityDot[currentAttack?.severity] || 'bg-white/40'} animate-pulse`} />
                {currentAttack?.severity || 'LOW'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Target</p>
                <p className="text-lg text-white mt-2">{currentAttack?.target || 'No target yet'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Status</p>
                <p className="text-lg text-lime-200 mt-2">{currentAttack?.status || 'Idle'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Risk Score</p>
                <p className={`text-lg mt-2 ${statusTone}`}>{riskScore}/100</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3 text-sm text-white/60 mb-2">
                <span className="inline-flex items-center gap-2"><Activity size={14} /> Risk posture</span>
                <span>{formatPercent(riskScore)}</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${riskScore >= 85 ? 'bg-rose-500' : riskScore >= 60 ? 'bg-orange-500' : riskScore >= 35 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.max(8, riskScore)}%` }} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">What it is</p>
                <p className="text-white/80">{currentAttack?.ai_analysis?.what_it_is || 'Run the simulator to generate an AI explanation.'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Why dangerous</p>
                <p className="text-white/80">{currentAttack?.ai_analysis?.why_dangerous || 'Risk explanation will appear here.'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Mitigation steps</p>
                <ul className="space-y-2 text-white/75 text-sm">
                  {(currentAttack?.ai_analysis?.mitigation_steps || []).map((step, index) => (
                    <li key={index} className="flex gap-2">
                      <ShieldAlert size={14} className="mt-0.5 text-cyan" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Recommended fixes</p>
                <ul className="space-y-2 text-white/75 text-sm">
                  {(currentAttack?.ai_analysis?.recommended_fixes || []).map((fix, index) => (
                    <li key={index} className="flex gap-2">
                      <Sparkles size={14} className="mt-0.5 text-warning" />
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">Terminal console</p>
                <h2 className="font-display text-xl text-lime mt-1">SOC telemetry</h2>
              </div>
              <div className="h-2.5 w-2.5 rounded-full bg-lime-400 animate-pulse" />
            </div>
            <div className="terminal-box min-h-[340px] bg-black/75 border border-lime-500/20 text-lime-200 overflow-hidden">
              {terminalLines.length ? terminalLines.map((line, index) => (
                <motion.p
                  key={`${line}-${index}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mb-2"
                >
                  <span className="text-lime-400">&gt;</span> {line}
                </motion.p>
              )) : (
                <p className="text-white/35">Waiting for a simulated attack...</p>
              )}
              <div className="mt-4 flex items-center gap-2 text-white/35">
                <span className="inline-block h-3 w-2 bg-white/50 animate-pulse" />
                <span>cursor blinking</span>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 xl:col-span-2 border border-white/10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">Event history</p>
                <h2 className="font-display text-xl text-cyan mt-1">Latest simulated attacks</h2>
              </div>
              <p className="text-white/50 text-sm">{history.length} events</p>
            </div>
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {history.length ? history.map((event) => (
                <div key={`${event.timestamp}-${event.attack}-${event.target}`} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-medium">{event.attack}</p>
                      <p className="text-white/50 text-sm">Target: {event.target}</p>
                      <p className="text-white/40 text-xs mt-1">{event.timestamp}</p>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${severityStyle[event.severity] || 'border-white/10 text-white/60'}`}>
                      {event.severity} • {event.status}
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-white/70 grid gap-2 sm:grid-cols-2">
                    <p>Risk score: <span className={statusTone}>{event.risk_score}/100</span></p>
                    <p>Indicator: <span className="text-cyan">{event.indicators?.[0] || 'n/a'}</span></p>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-white/60">
                  No simulated attacks yet. Trigger the generator to populate the history.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <p className="text-xs uppercase tracking-[0.25em] text-white/40">AI report</p>
            <h2 className="font-display text-xl text-lime mt-1">Copilot guidance</h2>
            <p className="text-white/70 mt-3">{currentAttack?.ai_analysis?.copilot_summary || 'The AI Copilot summary will appear after the next simulation.'}</p>
            <div className="mt-4 rounded-2xl border border-cyan/20 bg-cyan/5 p-3 text-sm text-white/70">
              This module is designed for demo use only and keeps the experience visually rich without changing your existing security modules.
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
