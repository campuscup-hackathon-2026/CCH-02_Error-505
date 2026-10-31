import { useState } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, ShieldAlert } from 'lucide-react';
import AppShell from '../components/AppShell';
import { predictThreat } from '../lib/securityCenter';

export default function ThreatPrediction() {
  const [telemetry, setTelemetry] = useState({ failed_logins: 12, suspicious_ips: 3, active_threats: 4, risk_score: 67, malware_hits: 1 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runPrediction() {
    setLoading(true);
    try {
      const data = await predictThreat(telemetry);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="glass-card p-5 border border-cyan/15">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">AI Threat Prediction Engine</p>
          <h1 className="font-display text-3xl text-cyan mt-2">Rule-based threat forecasting</h1>
          <p className="text-white/65 mt-2">This engine uses local signals and simple thresholds to forecast likely attack types.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3 text-white/70"><BrainCircuit size={18} className="text-cyan" /> Telemetry inputs</div>
            {Object.entries(telemetry).map(([key, value]) => (
              <label key={key} className="block mb-3">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">{key.replaceAll('_', ' ')}</span>
                <input type="number" value={value} onChange={(e) => setTelemetry((prev) => ({ ...prev, [key]: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-cyan/25 bg-black/30 p-3 text-white outline-none" />
              </label>
            ))}
            <button onClick={runPrediction} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan px-4 py-2 font-semibold text-black">
              <ShieldAlert size={16} /> {loading ? 'Predicting...' : 'Predict Threat'}
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">Prediction</p>
                <h2 className="font-display text-xl text-lime mt-1">{result?.prediction || 'Awaiting telemetry'}</h2>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">{result?.severity || 'LOW'}</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {result?.prediction_cards?.map((card) => (
                <div key={card.title} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <p className="text-white/40 text-xs uppercase tracking-[0.2em]">{card.title}</p>
                  <p className="text-3xl text-cyan mt-2">{card.value}</p>
                  <p className="text-xs text-white/55 mt-1">{card.hint}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">Defense action</p>
              <p className="text-white/80">{result?.recommended_action || 'Run a prediction to get a defensive recommendation.'}</p>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 terminal-box">
              <p className="text-lime-200">&gt; Prediction probability: {result?.probability_score ?? 0}%</p>
              <p className="text-lime-200">&gt; Threat mode: {result?.mode || 'MONITORING'}</p>
              <p className="text-lime-200">&gt; Failed logins: {result?.failed_logins ?? telemetry.failed_logins}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
