import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ShieldCheck, Zap, Radio, Gauge, Terminal, Brain, MapPinned } from 'lucide-react';
import AppShell from '../components/AppShell';
import SecurityScoreMeter from '../components/SecurityScoreMeter';
import AlertTicker from '../components/AlertTicker';
import { createAlertsSocket } from '../lib/socket';
import { getSecurityCenterOverview } from '../lib/securityCenter';

const heatmapPalette = {
  CRITICAL: 'rgba(251, 113, 133, 0.85)',
  HIGH: 'rgba(251, 146, 60, 0.78)',
  MEDIUM: 'rgba(251, 191, 36, 0.72)',
  LOW: 'rgba(52, 211, 153, 0.7)',
};

const countries = ['USA', 'China', 'Russia', 'Germany', 'India'];

function MatrixOverlay() {
  const columns = useMemo(() => Array.from({ length: 10 }, (_, index) => index), []);
  return (
    <div className="matrix-background">
      <div className="matrix-grid" />
      <div className="radar-pulse" />
      {columns.map((column) => (
        <div key={column} className="matrix-column" style={{ left: `${column * 11}%`, animationDuration: `${9 + column % 4}s` }}>
          {`01101010\n11010101\n00110110\n10101001\n01101110`}
        </div>
      ))}
    </div>
  );
}

export default function CommandCenter() {
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [mapEvents, setMapEvents] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await getSecurityCenterOverview();
        if (!alive) return;
        setOverview(data);
      } catch {}
    };
    load();

    const socket = createAlertsSocket((evt) => {
      if (evt?.channel === 'notification' && evt.payload) {
        setAlerts((prev) => [{ ...evt.payload, event_type: evt.payload.title || 'Notification', description: evt.payload.message || '' }, ...prev].slice(0, 12));
      }
      if (evt?.channel === 'soc_activity' && evt.payload) {
        setActivity((prev) => [{ severity: evt.payload.severity || 'INFO', text: evt.payload.entry || 'Monitoring network traffic' }, ...prev].slice(0, 12));
      }
      if (evt?.channel === 'threat_map_update' && evt.payload) {
        setMapEvents((prev) => [evt.payload, ...prev].slice(0, 8));
      }
      if (evt?.channel === 'integrity_update' && evt.payload) {
        setOverview((prev) => ({ ...(prev || {}), state: evt.payload }));
      }
    });

    const timer = window.setInterval(load, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      if (typeof socket.safeClose === 'function') socket.safeClose(); else socket.close();
    };
  }, []);

  const prediction = overview?.prediction || {};
  const recommendations = overview?.recommendations || {};
  const state = overview?.state || {};
  const alertsCount = alerts.length + (state.critical_alerts || 0);

  const performance = [
    { name: 'CPU', value: state.cpu_usage || 34 },
    { name: 'Memory', value: state.memory_usage || 41 },
    { name: 'AI Load', value: state.ai_load || 28 },
    { name: 'Integrity', value: state.system_integrity || 84 },
  ];

  const threatDistribution = [
    { name: 'Critical', value: alerts.filter((item) => (item.tone || item.severity) === 'critical').length + (state.threat_level === 'CRITICAL' ? 1 : 0) },
    { name: 'High', value: alerts.filter((item) => (item.tone || item.severity) === 'high').length + (state.threat_level === 'HIGH' ? 1 : 0) },
    { name: 'Medium', value: alerts.filter((item) => (item.tone || item.severity) === 'medium').length + (state.threat_level === 'MEDIUM' ? 1 : 0) },
    { name: 'Low', value: alerts.filter((item) => (item.tone || item.severity) === 'low').length + (state.threat_level === 'LOW' ? 1 : 0) },
  ];

  return (
    <AppShell>
      <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-[2rem] border border-white/10 bg-black/35 p-4 md:p-6">
        <MatrixOverlay />
        <div className="relative z-10 space-y-5">
          <div className="glass-card p-5 border border-cyan/20 bg-black/30">
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">Cybersecurity Command Center</p>
            <h1 className="font-display text-3xl md:text-5xl text-cyan mt-2">Futuristic AI Security OS</h1>
            <p className="text-white/65 mt-2 max-w-3xl">Cinematic offline SOC control with local predictions, recommendations, terminal telemetry, and global threat visualization.</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 xl:col-span-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Threat Heatmap</p>
                  <h2 className="font-display text-xl text-lime mt-1">Global incident density</h2>
                </div>
                <MapPinned size={18} className="text-cyan" />
              </div>
              <div className="grid gap-2">
                {countries.map((country, index) => {
                  const entry = mapEvents[index % Math.max(1, mapEvents.length)] || { severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'][index % 4], attack_count: 4 + index };
                  return (
                    <div key={country} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white font-medium">{country}</span>
                        <span className="text-xs uppercase tracking-[0.2em]" style={{ color: heatmapPalette[entry.severity] || '#7dd3fc' }}>{entry.severity}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${15 + entry.attack_count * 4}%`, background: heatmapPalette[entry.severity] || '#22d3ee' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 xl:col-span-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">AI Assistant Panel</p>
                  <h2 className="font-display text-xl text-cyan mt-1">Command status</h2>
                </div>
                <Brain size={18} className="text-cyan" />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Prediction</p>
                  <p className="text-white mt-1">{prediction.prediction || 'Awaiting local prediction'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <p className="text-white/40 text-xs uppercase tracking-[0.2em]">AI Recommendation</p>
                  <p className="text-white mt-1">{(recommendations.recommendations || [])[0]?.text || 'No recommendation yet'}</p>
                </div>
                <div className="terminal-box min-h-40">
                  <p className="text-lime-200">&gt; {state.last_action || 'System monitoring initialized.'}</p>
                  <p className="text-lime-200">&gt; {prediction.recommended_action || 'Local defense logic standing by.'}</p>
                  <p className="text-lime-200">&gt; {state.mode ? `Mode: ${state.mode}` : 'Mode: MONITORING'}</p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 xl:col-span-3 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Security Score</p>
                  <h2 className="font-display text-xl text-cyan mt-1">Current posture</h2>
                </div>
                <ShieldCheck size={18} className="text-cyan" />
              </div>
              <SecurityScoreMeter score={overview?.prediction?.probability_score ? 100 - overview.prediction.probability_score : state.system_integrity || 84} />
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-white/70">
                <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Critical alerts</p>
                <p className="text-2xl text-rose-200 mt-1">{alertsCount}</p>
              </div>
            </motion.div>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 xl:col-span-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Live Threat Feed</p>
                  <h2 className="font-display text-xl text-lime mt-1">Real-time notifications</h2>
                </div>
                <Zap size={18} className="text-lime" />
              </div>
              <AlertTicker alerts={alerts} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 xl:col-span-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Terminal Console</p>
                  <h2 className="font-display text-xl text-cyan mt-1">Telemetry feed</h2>
                </div>
                <Terminal size={18} className="text-cyan" />
              </div>
              <div className="terminal-box min-h-64 max-h-72 overflow-y-auto">
                {(activity.length ? activity : [
                  { severity: 'INFO', text: 'Monitoring network traffic' },
                  { severity: 'HIGH', text: 'Prompt injection blocked' },
                  { severity: 'CRITICAL', text: 'Malware behavior detected' },
                ]).map((item, index) => (
                  <p key={`${item.text}-${index}`} className="mb-1 text-lime-200">[{item.severity}] {item.text}</p>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 xl:col-span-3 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">System Metrics</p>
                  <h2 className="font-display text-xl text-cyan mt-1">Health overview</h2>
                </div>
                <Gauge size={18} className="text-cyan" />
              </div>
              <div className="space-y-3">
                {performance.map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/45 mb-1">
                      <span>{item.name}</span>
                      <span>{item.value}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Threat Predictions</p>
                  <h2 className="font-display text-xl text-lime mt-1">Probability forecast</h2>
                </div>
                <AlertTriangle size={18} className="text-amber-300" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {(prediction.prediction_cards || []).map((card) => (
                  <div key={card.title} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/40 text-xs uppercase tracking-[0.2em]">{card.title}</p>
                    <p className="text-2xl text-cyan mt-2">{card.value}</p>
                    <p className="text-xs text-white/55 mt-1">{card.hint}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Recommended defense action</p>
                <p className="text-white mt-1">{prediction.recommended_action || 'Awaiting local forecast'}</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">AI Recommendations</p>
                  <h2 className="font-display text-xl text-cyan mt-1">Priority response plan</h2>
                </div>
                <Radio size={18} className="text-cyan" />
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {(recommendations.recommendations || []).map((item) => (
                  <div key={item.text} className={`rounded-2xl border p-3 ${item.priority === 'critical' ? 'border-rose-500/40 bg-rose-500/10' : item.priority === 'high' ? 'border-orange-500/40 bg-orange-500/10' : 'border-cyan/20 bg-cyan/5'}`}>
                    <p className="text-white">{item.text}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45 mt-1">Priority: {item.priority}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
