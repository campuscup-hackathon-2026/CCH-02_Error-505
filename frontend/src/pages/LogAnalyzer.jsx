import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, UploadCloud, ShieldAlert } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

function displayValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

export default function LogAnalyzer() {
  const [logText, setLogText] = useState('Jan 01 10:22:01 auth sshd[123]: Failed password for admin from 10.0.0.12\nJan 01 10:22:04 auth sshd[123]: Failed password for admin from 10.0.0.12\nJan 01 10:22:07 auth sshd[123]: Failed password for admin from 10.0.0.12\nJan 01 10:22:10 auth sshd[123]: Failed password for admin from 10.0.0.12');
  const [fileName, setFileName] = useState('sample.log');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    try {
      const { data } = await api.post('/log-analyzer/analyze', { logs: logText });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function onFilePick(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLogText(await file.text());
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="glass-card p-5 border border-cyan/15">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">AI Log Analyzer</p>
          <h1 className="font-display text-3xl text-cyan mt-2">Local authentication and system log analysis</h1>
          <p className="text-white/65 mt-2">Upload a log file or paste raw log lines. The analyzer uses rule-based detection for brute force and repeated failures.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <div className="flex items-center gap-2 text-white/70 mb-3"><UploadCloud size={18} className="text-cyan" /> Log input</div>
            <input type="file" accept=".log,.txt,.json" onChange={onFilePick} className="w-full text-sm text-white/70" />
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/40">Loaded file: {fileName}</p>
            <textarea value={logText} onChange={(e) => setLogText(e.target.value)} rows={12} className="mt-3 w-full rounded-xl border border-cyan/25 bg-black/30 p-3 text-sm text-white outline-none" />
            <button onClick={analyze} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-lime px-4 py-2 font-semibold text-black">
              <FileText size={16} /> {loading ? 'Analyzing...' : 'Analyze Logs'}
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 border border-white/10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">Summary</p>
                <h2 className="font-display text-xl text-lime mt-1">{displayValue(result?.result) || 'Awaiting scan'}</h2>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">{result?.severity || 'LOW'}</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Risk score</p>
                <p className="text-3xl text-cyan mt-2">{result?.risk_score ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Failed logins</p>
                <p className="text-3xl text-warning mt-2">{result?.failed_login_count ?? 0}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 terminal-box min-h-44">
              {(result?.terminal_logs || ['Waiting for local analysis...']).map((line, index) => (
                <p key={index} className="mb-1 text-lime-200 whitespace-pre-wrap">&gt; {displayValue(line)}</p>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">AI-style summary</p>
              <p className="text-white/80 text-sm whitespace-pre-wrap">{displayValue(result?.summary) || 'The analyzer will summarize repeated failures, brute force hints, and suspicious IP activity.'}</p>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">Anomalies</p>
              <div className="space-y-1 text-white/80 text-sm max-h-44 overflow-y-auto pr-1">
                {(result?.anomalies || []).map((item, index) => (
                  <p key={index} className="flex gap-2"><ShieldAlert size={14} className="mt-0.5 text-warning shrink-0" />{displayValue(item)}</p>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
