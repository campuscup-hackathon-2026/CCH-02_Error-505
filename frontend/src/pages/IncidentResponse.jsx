import { useState } from 'react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

export default function IncidentResponse() {
  const [form, setForm] = useState({ threat_type: 'brute_force', severity: 'high', context: 'Multiple failed logins from same source network.' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportDownload, setReportDownload] = useState('');

  async function generate() {
    setLoading(true);
    try {
      const { data } = await api.post('/incidents/plan', form);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    setLoading(true);
    try {
      const { data } = await api.post('/reports/generate/incident', form);
      setReportDownload(data.download_path);
      setResult(data.plan || result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="font-display text-3xl text-cyan">Incident Response Assistant</h1>
        <div className="glass-card p-4 space-y-3">
          <input value={form.threat_type} onChange={(e) => setForm((f) => ({ ...f, threat_type: e.target.value }))} className="w-full p-3 bg-black/40 rounded border border-cyan/30" placeholder="Threat type" />
          <select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))} className="w-full p-3 bg-black/40 rounded border border-cyan/30">
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <textarea value={form.context} onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))} rows={4} className="w-full p-3 bg-black/40 rounded border border-cyan/30" />
          <button onClick={generate} disabled={loading} className="px-4 py-2 rounded bg-lime text-black font-semibold">
            {loading ? 'Generating remediation...' : 'Generate Response Plan'}
          </button>
        </div>

        {result && (
          <div className="glass-card p-4">
            <p className="text-white/60 mb-2">Threat Summary</p>
            <p className="text-white/80 mb-3">{result.attack_summary}</p>
            <p className="text-white/80 mb-3">{result.ai_explanation}</p>
            {result.containment_steps?.length ? (
              <div className="mb-4">
                <p className="text-white/60 mb-2">Containment</p>
                <ul className="list-disc list-inside space-y-1 text-white/80">
                  {result.containment_steps.map((step, index) => <li key={index}>{step}</li>)}
                </ul>
              </div>
            ) : null}
            <ul className="space-y-2 list-disc list-inside">
              {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            {result.recovery_steps?.length ? (
              <div className="mt-4">
                <p className="text-white/60 mb-2">Recovery</p>
                <ul className="list-disc list-inside space-y-1 text-white/80">
                  {result.recovery_steps.map((step, index) => <li key={index}>{step}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={generateReport} className="px-4 py-2 rounded bg-cyan text-black font-semibold" disabled={loading}>
                {loading ? 'Generating report...' : 'Generate Incident PDF'}
              </button>
              {reportDownload ? (
                <a href={reportDownload} className="px-4 py-2 rounded border border-lime text-lime hover:bg-lime/10">
                  Download Report
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
