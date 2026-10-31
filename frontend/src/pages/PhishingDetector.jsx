import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Link2, MailWarning, ShieldCheck } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

const samples = [
  'Urgent: Verify your password now to avoid account suspension. Click https://secure-login.example.com',
  'Your mailbox will be disabled unless you sign in immediately at http://bit.ly/reset-access',
  'Security alert: confirm your identity and reset MFA using the link below.',
];

export default function PhishingDetector() {
  const [content, setContent] = useState(samples[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    try {
      const { data } = await api.post('/phishing-detector/analyze', { content });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  const severityTone = result?.severity === 'CRITICAL' ? 'text-rose-300 border-rose-500/40 bg-rose-500/10' : result?.severity === 'HIGH' ? 'text-orange-300 border-orange-500/40 bg-orange-500/10' : result?.severity === 'MEDIUM' ? 'text-amber-200 border-amber-500/40 bg-amber-500/10' : 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10';

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="glass-card p-5 border border-cyan/15">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">AI Phishing Detector</p>
          <h1 className="font-display text-3xl text-cyan mt-2">Local phishing detection engine</h1>
          <p className="text-white/65 mt-2">Paste an email, message, or URL. This uses local regex and keyword logic only.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <div className="flex items-center gap-2 text-white/70 mb-3"><MailWarning size={18} className="text-cyan" /> Scan content</div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="w-full rounded-xl border border-cyan/25 bg-black/30 p-3 text-sm text-white outline-none" />
            <div className="flex flex-wrap gap-2 mt-3">
              {samples.map((sample) => (
                <button key={sample} onClick={() => setContent(sample)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/5">Sample</button>
              ))}
            </div>
            <button onClick={analyze} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-warning px-4 py-2 font-semibold text-black">
              <AlertTriangle size={16} /> {loading ? 'Analyzing...' : 'Analyze Phishing Risk'}
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">Risk report</p>
                <h2 className="font-display text-xl text-lime mt-1">{result?.result || 'Waiting for analysis'}</h2>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${severityTone}`}>{result?.severity || 'LOW'}</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Risk score</p>
                <p className="text-3xl text-cyan mt-2">{result?.risk_score ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Probability</p>
                <p className="text-3xl text-lime mt-2">{Math.round((result?.phishing_probability || 0) * 100)}%</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">Explanation</p>
              <p className="text-white/80 text-sm">{result?.explanation || 'The detector will explain urgency tactics, fake login links, and credential harvesting indicators.'}</p>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">Recommended action</p>
              <p className="text-white/80 text-sm">{result?.recommended_action || 'Review the content locally to produce a risk score.'}</p>
            </div>

            <div className="mt-3 terminal-box min-h-40">
              {(result?.terminal_logs || ['Waiting for local analysis...']).map((line, index) => (
                <p key={index} className="mb-1 text-lime-200">&gt; {line}</p>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(result?.indicators || []).map((item) => (
                <span key={item} className="rounded-full border border-cyan/20 bg-cyan/5 px-3 py-1 text-xs text-cyan">{item}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
