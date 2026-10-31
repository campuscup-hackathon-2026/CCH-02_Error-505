import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Globe2, Radio, ShieldAlert } from 'lucide-react';
import AppShell from '../components/AppShell';
import { createAlertsSocket } from '../lib/socket';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const seedItems = [
  { country: 'USA', severity: 'CRITICAL', lat: 37.0902, lon: -95.7129, attack_count: 18, headline: 'Ransomware campaign detected', timestamp: '10:00:00' },
  { country: 'China', severity: 'HIGH', lat: 35.8617, lon: 104.1954, attack_count: 11, headline: 'Zero-day exploit active', timestamp: '10:00:02' },
  { country: 'Russia', severity: 'MEDIUM', lat: 61.524, lon: 105.3188, attack_count: 7, headline: 'Credential stuffing attempt', timestamp: '10:00:04' },
  { country: 'Germany', severity: 'HIGH', lat: 51.1657, lon: 10.4515, attack_count: 9, headline: 'API token abuse spike', timestamp: '10:00:06' },
  { country: 'India', severity: 'LOW', lat: 20.5937, lon: 78.9629, attack_count: 5, headline: 'Recon sweep observed', timestamp: '10:00:08' },
];

const colors = {
  CRITICAL: '#fb7185',
  HIGH: '#fb923c',
  MEDIUM: '#fbbf24',
  LOW: '#34d399',
};

export default function ThreatMap() {
  const [events, setEvents] = useState(seedItems);

  useEffect(() => {
    const socket = createAlertsSocket((evt) => {
      if (evt?.channel === 'threat_map_update' && evt.payload) {
        setEvents((prev) => [evt.payload, ...prev].slice(0, 20));
      }
      if (evt?.channel === 'threat_feed_update' && evt.payload) {
        setEvents((prev) => [evt.payload, ...prev].slice(0, 20));
      }
    });

    return () => {
      if (typeof socket.safeClose === 'function') socket.safeClose(); else socket.close();
    };
  }, []);

  const counters = useMemo(() => events.reduce((acc, item) => {
    acc[item.country] = (acc[item.country] || 0) + 1;
    return acc;
  }, {}), [events]);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="glass-card p-5 border border-cyan/15">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">Threat Heatmap</p>
          <h1 className="font-display text-3xl text-cyan mt-2">Real-time global attack visualization</h1>
          <p className="text-white/65 mt-2">Synthetic threat-map updates stream over websocket channels and animate into the dashboard.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 xl:col-span-2 border border-white/10">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">Attack cloud</p>
                <h2 className="font-display text-xl text-lime mt-1">Live world map</h2>
              </div>
              <div className="flex items-center gap-2 text-white/60 text-sm"><Globe2 size={16} /> Websocket-synced</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-3 overflow-hidden">
              <ComposableMap projectionConfig={{ scale: 150 }} className="w-full h-[420px]">
                <Geographies geography={geoUrl}>
                  {({ geographies }) => geographies.map((geo) => (
                    <Geography key={geo.rsmKey} geography={geo} fill="#0b1224" stroke="#183153" />
                  ))}
                </Geographies>
                {events.map((item, index) => (
                  <Marker key={`${item.country}-${index}-${item.timestamp}`} coordinates={[item.lon, item.lat]}>
                    <circle r={6 + Math.min(8, item.attack_count / 4)} fill={colors[item.severity] || '#60a5fa'} fillOpacity={0.7} stroke="#fff" strokeWidth={1} />
                  </Marker>
                ))}
              </ComposableMap>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <div className="flex items-center gap-2 text-white/70 mb-3"><Radio size={18} className="text-cyan" /> Attack counters</div>
            <div className="space-y-3">
              {Object.entries(counters).map(([country, count]) => (
                <div key={country} className="rounded-2xl border border-white/10 bg-black/25 p-3 flex items-center justify-between gap-2">
                  <span className="text-white">{country}</span>
                  <span className="text-cyan font-semibold">{count}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 terminal-box max-h-80 overflow-y-auto">
              {events.map((item, index) => (
                <motion.div key={`${item.country}-${index}-${item.timestamp}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="mb-2">
                  <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors[item.severity] || '#7dd3fc' }}>[{item.severity}] {item.country}</p>
                  <p className="text-lime-200">{item.headline}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {events.slice(0, 4).map((item, index) => (
            <motion.div key={`${item.country}-${index}-${item.timestamp}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">{item.country}</p>
                  <h3 className="font-display text-lg text-white mt-1">{item.headline}</h3>
                </div>
                <ShieldAlert size={18} style={{ color: colors[item.severity] || '#7dd3fc' }} />
              </div>
              <p className="mt-3 text-sm text-white/70">{item.attack_count} simulated attacks at {item.timestamp}</p>
              <div className="mt-3 inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]" style={{ borderColor: `${colors[item.severity] || '#7dd3fc'}66`, color: colors[item.severity] || '#7dd3fc' }}>
                {item.severity}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
