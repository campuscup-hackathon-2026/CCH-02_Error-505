import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import AlertTicker from '../components/AlertTicker';
import { createAlertsSocket } from '../lib/socket';

export default function LiveAttackFeed() {
  const [alerts, setAlerts] = useState([]);

  function normalizeAlert(payload) {
    if (payload?.attack) {
      return {
        event_type: payload.attack,
        description: `${payload.status} at ${payload.target}`,
        source_ip: payload.source_ip || 'simulated',
        severity: payload.severity,
      };
    }

    if (payload?.headline) {
      return {
        event_type: payload.headline,
        description: `${payload.country} has ${payload.attack_count} simulated alerts`,
        source_ip: payload.country,
        severity: payload.severity,
      };
    }

    return payload;
  }

  useEffect(() => {
    const ws = createAlertsSocket((evt) => {
      if ((evt?.channel === 'attack_simulation' || evt?.channel === 'threat_feed_update') && evt.payload) {
        setAlerts((prev) => [normalizeAlert(evt.payload), ...prev].slice(0, 200));
      }
    });

    return () => {
      if (typeof ws.safeClose === 'function') ws.safeClose(); else ws.close();
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl text-cyan">Live Attack Feed</h1>
          <p className="text-white/70">Real-time incoming alerts and telemetry stream.</p>
        </div>

        <div className="glass-card p-4">
          <AlertTicker alerts={alerts} />
        </div>
      </div>
    </AppShell>
  );
}
