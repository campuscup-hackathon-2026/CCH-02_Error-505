import { useState } from 'react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

const sampleLogs = [
  { timestamp: new Date().toISOString(), source_ip: '192.168.1.22', action: 'login', status: 'failed', user_agent: 'Mozilla/5.0 VPNClient' },
  { timestamp: new Date().toISOString(), source_ip: '192.168.1.22', action: 'login', status: 'failed', user_agent: 'Mozilla/5.0 VPNClient' },
  { timestamp: new Date().toISOString(), source_ip: '192.168.1.22', action: 'login', status: 'failed', user_agent: 'Mozilla/5.0 VPNClient' },
  { timestamp: new Date().toISOString(), source_ip: '192.168.1.22', action: 'login', status: 'failed', user_agent: 'Mozilla/5.0 VPNClient' },
  { timestamp: new Date().toISOString(), source_ip: '192.168.1.22', action: 'login', status: 'failed', user_agent: 'Mozilla/5.0 VPNClient' },
  { timestamp: new Date().toISOString(), source_ip: '10.1.2.33', action: 'api_request', status: 'ok', user_agent: 'LoadGen Proxy' },
];

function displayValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

export default function ThreatHunter() {
  const [logs, setLogs] = useState(JSON.stringify(sampleLogs, null, 2));
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function hunt() {
    setLoading(true);
    try {
      let parsedLogs;
      try {
        parsedLogs = JSON.parse(logs);
      } catch (parseErr) {
        // try newline-delimited JSON lines
        const lines = logs.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        try {
          parsedLogs = lines.map((l) => JSON.parse(l));
        } catch (e) {
          setResult(null);
          setLoading(false);
          setError('Logs must be valid JSON array or newline-delimited JSON objects.');
          return;
        }
      }

      const res = await api.post('/threats/hunt', { logs: parsedLogs });
      // axios returns parsed JSON as res.data; normalize
      const data = res?.data ?? res;
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="font-display text-3xl text-cyan">Threat Hunter Assistant</h1>
        <div className="glass-card p-4">
          <p className="text-white/70 mb-2">Run simulated attack detection across login/network logs.</p>
          <textarea
            value={logs}
            onChange={(e) => setLogs(e.target.value)}
            rows={10}
            className="w-full p-3 bg-black/40 rounded border border-cyan/30 mb-2"
          />
          <button onClick={hunt} disabled={loading} className="px-4 py-2 rounded bg-danger text-black font-semibold">
            {loading ? 'Hunting threats...' : 'Run Threat Hunt'}
          </button>
        </div>

        {result && (
          <div className="glass-card p-4 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <p>Threat Score: <span className="text-danger">{result.threat_score}</span></p>
              <p>Predicted Next Severity: <span className="uppercase text-warning">{displayValue(result.predicted_next_severity)}</span></p>
              <p>Alerts: <span className="text-cyan">{result.alerts.length}</span></p>
              <p>Enriched Alerts: <span className="text-lime">{result.enriched_alerts?.length || 0}</span></p>
            </div>
            <p className="whitespace-pre-wrap">{displayValue(result.summary)}</p>
            {result.anomaly_summary ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-white/70">
                <div className="terminal-box">
                  <p className="text-lime mb-2">Top Failed IPs</p>
                  {result.anomaly_summary.top_failed_ips?.map((row, i) => <p key={i}>{displayValue(row.ip)} :: {displayValue(row.failed_attempts)}</p>)}
                </div>
                <div className="terminal-box">
                  <p className="text-lime mb-2">Unusual User Agents</p>
                  {result.anomaly_summary.unusual_user_agents?.map((row, i) => <p key={i}>{displayValue(row.user_agent)} :: {displayValue(row.count)}</p>)}
                </div>
                <div className="terminal-box">
                  <p className="text-lime mb-2">Suspicious Login Sources</p>
                  {result.anomaly_summary.suspicious_login_sources?.map((row, i) => <p key={i}>{displayValue(row.ip)} / {displayValue(row.action)} :: {displayValue(row.count)}</p>)}
                </div>
              </div>
            ) : null}
            <div className="terminal-box">
              {result.alerts.map((a, i) => (
                <div key={i} className="mb-3 border-b border-white/10 pb-3">
                  <p>{displayValue(a.type)} | {displayValue(a.source_ip)} | {displayValue(a.severity)} | confidence {displayValue(a.confidence)}</p>
                  {a.ip_intel && (
                    <p className="text-white/60 text-xs mt-1">
                      Intel: score {displayValue(a.ip_intel.threat_reputation_score)} | {displayValue(a.ip_intel.asn)} | {displayValue(a.ip_intel.country)} | tor {a.ip_intel.is_tor ? 'yes' : 'no'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {error && (
          <div className="glass-card p-4 bg-red-900">
            <p className="text-white">Error: {error}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
