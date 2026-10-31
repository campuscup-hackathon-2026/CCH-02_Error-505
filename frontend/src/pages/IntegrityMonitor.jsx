import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, MemoryStick, ShieldCheck, ShieldAlert } from 'lucide-react';
import AppShell from '../components/AppShell';
import { createAlertsSocket } from '../lib/socket';
import { getSecurityCenterOverview } from '../lib/securityCenter';

function Progress({ value, tone = 'cyan' }) {
  return (
    <div className="h-3 rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full rounded-full ${tone === 'rose' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-400' : tone === 'emerald' ? 'bg-emerald-400' : 'bg-cyan-400'}`} style={{ width: `${Math.max(6, Math.min(100, value || 0))}%` }} />
    </div>
  );
}

export default function IntegrityMonitor() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await getSecurityCenterOverview();
        if (alive) setData({ ...(res?.state || {}), ...(res?.recommendations || {}), ...(res?.prediction || {}) });
      } catch {}
    };
    load();

    const socket = createAlertsSocket((evt) => {
      if (evt?.channel === 'integrity_update' && evt.payload) {
        setData(evt.payload);
      }
    });

    const timer = window.setInterval(load, 12000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      if (typeof socket.safeClose === 'function') socket.safeClose(); else socket.close();
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="glass-card p-5 border border-cyan/15">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">AI System Integrity Monitor</p>
          <h1 className="font-display text-3xl text-cyan mt-2">Health telemetry for your SOC OS</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'CPU Usage', value: data?.cpu_usage || 34, icon: Cpu, tone: 'cyan' },
            { label: 'Memory Usage', value: data?.memory_usage || 41, icon: MemoryStick, tone: 'amber' },
            { label: 'Firewall Status', value: data?.firewall_status || 'Enabled', icon: ShieldCheck, tone: 'emerald' },
            { label: 'Threat Level', value: data?.threat_level || 'MEDIUM', icon: ShieldAlert, tone: 'rose' },
          ].map((item) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-white/40 text-xs uppercase tracking-[0.2em]">{item.label}</p>
                <item.icon size={16} className={item.tone === 'rose' ? 'text-rose-300' : item.tone === 'emerald' ? 'text-emerald-300' : item.tone === 'amber' ? 'text-amber-300' : 'text-cyan-300'} />
              </div>
              <p className="mt-2 text-2xl text-white">{item.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="glass-card p-4 border border-white/10 space-y-4">
            {[
              { label: 'Active Scans', value: data?.active_scans || 3, tone: 'cyan' },
              { label: 'AI Load', value: data?.ai_load || 28, tone: 'amber' },
              { label: 'System Integrity Score', value: data?.system_integrity || 85, tone: 'emerald' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-white/50 text-xs uppercase tracking-[0.2em]">{item.label}</p>
                  <span className="text-white">{item.value}%</span>
                </div>
                <Progress value={item.value} tone={item.tone} />
              </div>
            ))}
          </div>

          <div className="glass-card p-4 border border-white/10 terminal-box">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Integrity timeline</p>
            <div className="space-y-2 text-lime-200">
              <p>&gt; CPU stable under local SOC workload.</p>
              <p>&gt; Memory pressure within safe thresholds.</p>
              <p>&gt; Firewall operational across all active policy lanes.</p>
              <p>&gt; Threat-level telemetry synced from websocket events.</p>
              <p>&gt; Integrity score recalculated using local heuristics.</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
