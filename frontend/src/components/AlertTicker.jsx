import { memo } from 'react';
import { motion } from 'framer-motion';

function AlertTicker({ alerts = [] }) {
  const visibleAlerts = alerts.slice(0, 12);

  return (
    <div className="glass-card p-4 overflow-hidden will-change-transform">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg text-danger">Live Threat Feed</h2>
        <span className="text-xs text-white/60">Real-time SOC alerts</span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {visibleAlerts.length === 0 && <p className="text-white/70 text-sm">No active alerts yet.</p>}
        {visibleAlerts.map((alert, idx) => (
          <motion.div
            key={`${alert.event_type}-${idx}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="p-3 rounded-lg border border-danger/40 bg-danger/10 transform-gpu"
          >
            <p className="font-semibold text-danger uppercase tracking-wide">{alert.event_type}</p>
            <p className="text-sm text-white/80">{alert.description}</p>
            <p className="text-xs text-white/60 mt-1">
              Source: {alert.source_ip} | Severity: {alert.severity}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default memo(AlertTicker);
