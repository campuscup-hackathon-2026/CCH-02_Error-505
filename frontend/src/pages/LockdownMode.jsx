import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, ShieldOff, ShieldX } from 'lucide-react';
import AppShell from '../components/AppShell';
import { createAlertsSocket } from '../lib/socket';
import { getSecurityCenterState, initiateLockdown, releaseLockdown } from '../lib/securityCenter';

export default function LockdownMode() {
  const [state, setState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    getSecurityCenterState().then((data) => {
      if (alive) setState(data);
    }).catch(() => {});

    const socket = createAlertsSocket((evt) => {
      if (evt?.channel === 'lockdown_state' && evt.payload) {
        setState(evt.payload);
        setLogs(evt.payload.logs || []);
      }
    });

    return () => {
      alive = false;
      if (typeof socket.safeClose === 'function') socket.safeClose(); else socket.close();
    };
  }, []);

  const isLockdown = state?.mode === 'LOCKDOWN';
  const pulseTone = useMemo(() => isLockdown ? 'text-rose-200' : 'text-cyan', [isLockdown]);

  async function enableLockdown() {
    setLoading(true);
    try {
      const data = await initiateLockdown();
      setState(data);
      setLogs(data.logs || []);
    } finally {
      setLoading(false);
    }
  }

  async function disableLockdown() {
    setLoading(true);
    try {
      const data = await releaseLockdown();
      setState(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="glass-card p-5 border border-rose-500/20 bg-black/30">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">Emergency Lockdown Mode</p>
          <h1 className="font-display text-3xl text-rose-200 mt-2">Cinematic defense switch for crisis response</h1>
          <p className="text-white/65 mt-2">This mode changes the entire UI into a red emergency posture and intensifies SOC telemetry.</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={isLockdown ? disableLockdown : enableLockdown}
          disabled={loading}
          className={`w-full rounded-3xl border-2 p-8 font-display text-3xl tracking-[0.3em] transition ${isLockdown ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100 shadow-lg shadow-emerald-500/20' : 'border-rose-500/70 bg-rose-500/15 text-rose-100 shadow-lg shadow-rose-500/20 animate-pulse'}`}
        >
          {loading ? 'PROCESSING...' : isLockdown ? 'RELEASE LOCKDOWN' : 'INITIATE LOCKDOWN'}
        </motion.button>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="glass-card p-4 border border-white/10 xl:col-span-2">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">Emergency status</p>
                <h2 className={`font-display text-2xl ${pulseTone} mt-1`}>{state?.mode || 'MONITORING'}</h2>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${isLockdown ? 'border-rose-400/40 bg-rose-400/10 text-rose-200' : 'border-cyan/30 bg-cyan/10 text-cyan'}`}>
                {state?.lockdown ? 'Locked Down' : 'Standby'}
              </div>
            </div>
            <div className="terminal-box min-h-56 border-rose-500/30 bg-black/70 text-rose-100">
              {(logs.length ? logs : ['[LOCKDOWN] Awaiting emergency activation...']).map((line, index) => (
                <p key={index} className="mb-1">&gt; {line}</p>
              ))}
            </div>
          </div>

          <div className="glass-card p-4 border border-white/10 space-y-3">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Firewall</p>
              <p className="text-2xl text-rose-200 mt-1">{isLockdown ? 'Active' : 'Watch'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Activated At</p>
              <p className="text-white mt-1">{state?.activated_at || 'Not active'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Last Action</p>
              <p className="text-white mt-1">{state?.last_action || 'No action yet'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3 flex items-center gap-2 text-sm text-white/70">
              {isLockdown ? <ShieldX className="text-rose-300" size={16} /> : <ShieldAlert className="text-cyan" size={16} />}
              <span>{isLockdown ? 'Emergency protocols are active' : 'System is currently not in lockdown'}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Lockdown State', value: state?.lockdown ? 'ON' : 'OFF' },
            { label: 'Intensity', value: state?.intensity || 'medium' },
            { label: 'Mode', value: state?.mode || 'MONITORING' },
            { label: 'Protocol', value: isLockdown ? 'DEFENSE' : 'NORMAL' },
          ].map((item) => (
            <div key={item.label} className="glass-card p-4 border border-white/10">
              <p className="text-white/40 text-xs uppercase tracking-[0.2em]">{item.label}</p>
              <p className={`text-2xl mt-2 ${isLockdown ? 'text-rose-200' : 'text-cyan'}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
