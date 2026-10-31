import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import AppShell from '../components/AppShell';
import { createAlertsSocket } from '../lib/socket';

const seed = [
  { severity: 'INFO', text: 'Monitoring network traffic' },
  { severity: 'HIGH', text: 'Prompt injection blocked' },
  { severity: 'CRITICAL', text: 'Malware behavior detected' },
  { severity: 'SAFE', text: 'Firewall operational' },
];

export default function SocActivityFeed() {
  const [events, setEvents] = useState(seed);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setEvents((prev) => [prev[0], ...prev.slice(1), prev[0]].slice(0, 8));
    }, 4500);

    const socket = createAlertsSocket((evt) => {
      if (evt?.channel === 'soc_activity' && evt.payload) {
        const item = evt.payload.entry || 'Monitoring network traffic';
        setEvents((prev) => [{ severity: evt.payload.severity || 'INFO', text: item }, ...prev].slice(0, 8));
      }
    });

    return () => {
      window.clearInterval(interval);
      if (typeof socket.safeClose === 'function') socket.safeClose(); else socket.close();
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="glass-card p-5 border border-cyan/15">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">Real-Time SOC Activity Feed</p>
          <h1 className="font-display text-3xl text-cyan mt-2">Continuously rotating security activity</h1>
        </div>

        <div className="glass-card p-4 border border-white/10">
          <div className="flex items-center gap-2 text-white/70 mb-3"><Activity size={18} className="text-cyan" /> Live stream</div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {events.map((event, index) => (
              <motion.div key={`${event.text}-${index}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className={`rounded-2xl border p-3 ${event.severity === 'CRITICAL' ? 'border-rose-500/40 bg-rose-500/10' : event.severity === 'HIGH' ? 'border-orange-500/40 bg-orange-500/10' : event.severity === 'SAFE' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-cyan/20 bg-cyan/5'}`}>
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">[{event.severity}]</p>
                <p className="text-white mt-1">{event.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
