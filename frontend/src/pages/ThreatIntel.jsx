import { useState } from 'react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

function providerLabel(provider) {
  if (provider === 'enriched') return 'Enriched';
  if (provider === 'no_upstream_hits') return 'No upstream hits';
  if (provider === 'local') return 'Local heuristic';
  if (provider === 'fallback') return 'Fallback';
  return provider || 'Fallback';
}

function providerTone(provider) {
  if (provider === 'enriched') return 'text-lime';
  if (provider === 'no_upstream_hits') return 'text-cyan';
  return 'text-warning';
}

export default function ThreatIntel() {
  const [indicator, setIndicator] = useState('8.8.8.8');
  const [kind, setKind] = useState('ip');
  const [userAgent, setUserAgent] = useState('Mozilla/5.0 VPNClient');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    setLoading(true);
    try {
      const { data } = await api.post('/intelligence/lookup', { indicator, kind, user_agent: userAgent });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="font-display text-3xl text-cyan">Threat Intelligence Integration</h1>
        <p className="text-white/70 max-w-3xl">Lookup IPs and domains with VirusTotal, ThreatFox, AbuseIPDB, and Shodan-backed enrichment.</p>

        <div className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={indicator} onChange={(e) => setIndicator(e.target.value)} className="w-full p-3 bg-black/40 rounded border border-cyan/30" placeholder="IP or domain" />
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full p-3 bg-black/40 rounded border border-cyan/30">
              <option value="ip">IP</option>
              <option value="domain">Domain</option>
            </select>
            <input value={userAgent} onChange={(e) => setUserAgent(e.target.value)} className="w-full p-3 bg-black/40 rounded border border-cyan/30" placeholder="User agent (optional)" />
          </div>
          <button onClick={lookup} disabled={loading} className="px-4 py-2 rounded bg-warning text-black font-semibold">
            {loading ? 'Looking up...' : 'Run Threat Intel Lookup'}
          </button>
        </div>

        {result && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="glass-card p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p>Malicious: <span className="uppercase text-danger">{result.malicious ? 'yes' : 'no'}</span></p>
                <p>Reputation: <span className="text-cyan">{result.threat_reputation_score}</span></p>
                <p>ASN: <span className="text-white">{result.asn}</span></p>
                <p>Country: <span className="text-white">{result.country}</span></p>
                <p>Tor: <span className="text-warning">{result.is_tor ? 'yes' : 'no'}</span></p>
                <p>Proxy: <span className="text-warning">{result.is_proxy ? 'yes' : 'no'}</span></p>
                <p>VPN: <span className="text-warning">{result.is_vpn ? 'yes' : 'no'}</span></p>
                <p>Sources: <span className="text-lime">{Object.keys(result.sources || {}).length}</span></p>
              </div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">
                Analysis source: <span className={providerTone(result.provider)}>{providerLabel(result.provider)}</span>
              </p>
              <div className="terminal-box">
                <p className="text-lime mb-2">Indicators</p>
                {result.indicators?.map((item, index) => <p key={index}>{item}</p>)}
              </div>
            </div>

            <div className="glass-card p-4 space-y-3">
              <h2 className="font-display text-lg text-cyan">Source Intelligence</h2>
              <div className="space-y-2 text-sm text-white/80 max-h-[420px] overflow-y-auto pr-1">
                {Object.entries(result.sources || {}).map(([source, payload]) => (
                  <div key={source} className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-lime uppercase tracking-[0.2em] text-[11px] mb-2">{source}</p>
                    <pre className="whitespace-pre-wrap text-white/70 text-xs">{JSON.stringify(payload, null, 2)}</pre>
                  </div>
                ))}
                {!Object.keys(result.sources || {}).length ? <p>No upstream source hits were returned for this indicator.</p> : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
