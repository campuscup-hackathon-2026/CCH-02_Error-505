import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, ShieldAlert, ShieldX, Siren } from 'lucide-react';
import AppShell from '../components/AppShell';
import { getRecommendations, setSecurityMode } from '../lib/securityCenter';

export default function AIRecommendations() {
  const [telemetry, setTelemetry] = useState({ risk_score: 82, malware_hits: 1, active_threats: 5 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runRecommendations() {
    setLoading(true);
    try {
      const data = await getRecommendations(telemetry);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function setMode(mode) {
    await setSecurityMode(mode);
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="glass-card p-5 border border-cyan/15">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">AI Recommendation Engine</p>
          <h1 className="font-display text-3xl text-cyan mt-2">Local defensive action planner</h1>
          <p className="text-white/65 mt-2">Rules generate priority recommendations with no cloud services required.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3 text-white/70"><Lightbulb size={18} className="text-cyan" /> Telemetry</div>
            {Object.entries(telemetry).map(([key, value]) => (
              <label key={key} className="block mb-3">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">{key.replaceAll('_', ' ')}</span>
                <input type="number" value={value} onChange={(e) => setTelemetry((prev) => ({ ...prev, [key]: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-cyan/25 bg-black/30 p-3 text-white outline-none" />
              </label>
            ))}
            <button onClick={runRecommendations} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-warning px-4 py-2 font-semibold text-black">
              <ShieldAlert size={16} /> {loading ? 'Generating...' : 'Generate Recommendations'}
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              {['SAFE', 'MONITORING', 'DEFENSE', 'LOCKDOWN'].map((mode) => (
                <button key={mode} onClick={() => setMode(mode)} className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70 hover:bg-white/5">{mode}</button>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">Recommended actions</p>
                <h2 className="font-display text-xl text-lime mt-1">{result?.mode || 'Waiting for analysis'}</h2>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">Risk {result?.risk_score ?? telemetry.risk_score}</div>
            </div>

            <div className="space-y-3">
              {(result?.recommendations || []).map((item) => (
                <div key={item.text} className={`rounded-2xl border p-3 ${item.priority === 'critical' ? 'border-rose-500/40 bg-rose-500/10' : item.priority === 'high' ? 'border-orange-500/40 bg-orange-500/10' : 'border-cyan/20 bg-cyan/5'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{item.text}</p>
                    {item.priority === 'critical' ? <ShieldX size={16} className="text-rose-300" /> : <Siren size={16} className="text-cyan" />}
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45 mt-1">Priority: {item.priority}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 terminal-box">
              <p className="text-lime-200">&gt; Restrict external API traffic</p>
              <p className="text-lime-200">&gt; Enable emergency firewall rules</p>
              <p className="text-lime-200">&gt; Block suspicious IP activity</p>
              <p className="text-lime-200">&gt; Run malware isolation scan</p>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
