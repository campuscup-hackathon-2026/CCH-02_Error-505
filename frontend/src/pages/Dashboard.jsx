import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import KpiCard from '../components/KpiCard';
import AlertTicker from '../components/AlertTicker';
import SeverityChart from '../components/SeverityChart';
import SecurityScoreMeter from '../components/SecurityScoreMeter';
import { createAlertsSocket } from '../lib/socket';
import { getEnterpriseDashboard } from '../lib/dashboard';

export default function Dashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingReload, setPendingReload] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadMetrics = useCallback(async (options = {}) => {
    const data = await getEnterpriseDashboard(options);
    setMetrics(data);
    setLastUpdated(new Date());
    setLoadError('');
    return true;
  }, []);

  const scheduleReload = useCallback(() => {
    setPendingReload((current) => current || true);
  }, []);

  useEffect(() => {
    let active = true;

    loadMetrics()
      .catch(() => {
        if (active) setLoadError('Dashboard telemetry is temporarily unavailable.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    const ws = createAlertsSocket((evt) => {
      if (evt?.channel === 'simulation_alert' || evt?.channel === 'attack_simulation') {
        if (evt.payload) {
          setAlerts((prev) => [evt.payload, ...prev].slice(0, 25));
          scheduleReload();
        }
      } else if (evt.payload) {
        setAlerts((prev) => [evt.payload, ...prev].slice(0, 25));
        scheduleReload();
      }
    });

    const refreshTimer = window.setInterval(() => {
      scheduleReload();
    }, 20000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      if (typeof ws.safeClose === 'function') {
        ws.safeClose();
      } else {
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingReload) return undefined;
    const timer = window.setTimeout(() => {
      setPendingReload(false);
      void loadMetrics().catch(() => setLoadError('Dashboard telemetry is temporarily unavailable.'));
    }, 180);

    return () => window.clearTimeout(timer);
  }, [loadMetrics, pendingReload]);

  const severityData = useMemo(() => metrics?.severity_distribution || [], [metrics]);
  const attackTimelineData = useMemo(() => metrics?.attack_timeline || [], [metrics]);
  const heatmapData = useMemo(() => metrics?.risk_heatmap || [], [metrics]);
  const activityTimelineData = useMemo(() => metrics?.activity_timeline || [], [metrics]);
  const threatIntelData = useMemo(() => metrics?.threat_intel || [], [metrics]);
  const heatmapTimes = useMemo(() => [...new Set(heatmapData.map((item) => item.time))].slice(0, 8), [heatmapData]);
  const heatmapLookup = useMemo(() => new Map(heatmapData.map((item) => [`${item.time}-${item.severity}`, item.value])), [heatmapData]);
  const heatmapSeverities = ['critical', 'high', 'medium', 'low'];

  function heatmapIntensity(value) {
    const alpha = Math.min(0.9, 0.15 + value * 0.2);
    return `rgba(0, 245, 212, ${alpha})`;
  }

  const reportActions = [
    { label: 'Vulnerability Report', helper: 'Generate from the latest source scans', action: () => navigate('/analyst') },
    { label: 'Incident Report', helper: 'Package containment and recovery guidance', action: () => navigate('/incident-response') },
    { label: 'Attack Simulator', helper: 'Launch a live AI attack demo', action: () => navigate('/attack-simulator') },
  ];

  const reportReadyCount = (metrics?.total_scans || 0) + (metrics?.recent_threats?.length || 0);

  async function manualRefresh() {
    setRefreshing(true);
    try {
      await loadMetrics({ force: true });
    } catch {
      setLoadError('Dashboard telemetry is temporarily unavailable.');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <AppShell>
        <div className="space-y-5">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-cyan tracking-wide">SentinelAI SOC Command Center</h1>
          <p className="text-white/70">Real-time cyber defense analytics, threat telemetry, and AI assistant orchestration.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="threat-signal" aria-label="Live threat signal is active">
              <span className="threat-signal__core" aria-hidden="true" />
              <span>Live threat signal</span>
              <strong>{metrics?.active_threats || metrics?.critical_alerts || 0} active</strong>
            </div>
            <p className="text-white/45 text-sm">{lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Waiting for telemetry...'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={manualRefresh} disabled={refreshing} className="px-4 py-2 rounded bg-cyan text-black font-semibold">
            {refreshing ? 'Refreshing...' : 'Refresh Dashboard'}
          </button>
          <div className="text-sm text-white/50">Auto-refreshes every 20 seconds and on new alert events.</div>
        </div>

        {loading && <div className="glass-card p-4">Loading real-time security posture...</div>}
        {loadError && (
          <div role="status" className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            {loadError} You can retry with “Refresh Dashboard”.
          </div>
        )}

        {metrics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card content-surface p-5 md:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/40">Enterprise posture</p>
                    <h2 className="font-display text-2xl text-lime mt-1">{metrics.scan_status?.message || 'Monitoring active'}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-white/50 text-sm">AI recommendations</p>
                    <p className="text-cyan font-semibold">{metrics.ai_recommendations?.length || 0} active</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-white/75">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/45 uppercase tracking-[0.2em] text-[11px]">Active Scans</p>
                    <p className="text-2xl text-white mt-1">{metrics.active_scans}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/45 uppercase tracking-[0.2em] text-[11px]">High Risk Scans</p>
                    <p className="text-2xl text-warning mt-1">{metrics.high_scans}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/45 uppercase tracking-[0.2em] text-[11px]">Threat Intel Hits</p>
                    <p className="text-2xl text-danger mt-1">{metrics.total_threats}</p>
                  </div>
                </div>
              </motion.div>
              <SecurityScoreMeter score={metrics.security_score} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard title="Security Score" value={metrics.security_score} subtitle="Composite SOC health" />
              <KpiCard title="Total Scans" value={metrics.total_scans} accent="warning" />
              <KpiCard title="Avg Risk" value={metrics.avg_risk} accent="danger" />
              <KpiCard title="Threat Events" value={metrics.total_threats} accent="danger" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard title="Total Attacks Blocked" value={metrics.total_attacks_blocked || 0} subtitle="Simulator and alert feed" />
              <KpiCard title="Active Threats" value={metrics.active_threats || 0} accent="danger" subtitle="High + critical events" />
              <KpiCard title="AI Risk Score" value={metrics.ai_risk_score || 0} accent="warning" subtitle="Avg simulated risk" />
              <KpiCard title="Critical Alerts" value={metrics.critical_alerts || 0} accent="danger" subtitle="Requires immediate review" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard title="Firewall Status" value={metrics.firewall_status || 'Enabled'} subtitle="Policy enforcement" />
              <KpiCard title="AI Threat Level" value={metrics.ai_threat_level || 'Medium'} accent="warning" subtitle="Local analytic risk" />
              <KpiCard title="System Integrity" value={metrics.system_integrity ?? 0} accent="cyan" subtitle="Integrity index" />
              <KpiCard title="Vulnerabilities Detected" value={metrics.vulnerabilities_detected || 0} accent="danger" subtitle="Open findings" />
            </div>

            <div className="glass-card content-surface p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-cyan/15">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">AI Attack Simulator</p>
                <h2 className="font-display text-2xl text-cyan mt-1">Launch live attack scenarios for demos and training</h2>
                <p className="text-white/60 mt-1">Generate realistic attack events, watch websocket updates, and get AI mitigation guidance in one flow.</p>
              </div>
              <button onClick={() => navigate('/attack-simulator')} className="px-4 py-2 rounded bg-warning text-black font-semibold shadow-lg shadow-warning/20">
                Open Simulator
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button onClick={() => navigate('/phishing-detector')} className="glass-card content-surface p-4 text-left border border-white/10 hover:border-cyan/40 transition">
                <p className="text-white/45 text-xs uppercase tracking-[0.2em]">New Module</p>
                <h3 className="font-display text-xl text-cyan mt-1">AI Phishing Detector</h3>
                <p className="text-white/60 text-sm mt-1">Analyze emails, links, and urgency tactics locally.</p>
              </button>
              <button onClick={() => navigate('/log-analyzer')} className="glass-card content-surface p-4 text-left border border-white/10 hover:border-cyan/40 transition">
                <p className="text-white/45 text-xs uppercase tracking-[0.2em]">New Module</p>
                <h3 className="font-display text-xl text-cyan mt-1">AI Log Analyzer</h3>
                <p className="text-white/60 text-sm mt-1">Detect brute force attempts, repeated failures, and suspicious IP activity.</p>
              </button>
              <button onClick={() => navigate('/threat-map')} className="glass-card content-surface p-4 text-left border border-white/10 hover:border-cyan/40 transition">
                <p className="text-white/45 text-xs uppercase tracking-[0.2em]">New Module</p>
                <h3 className="font-display text-xl text-cyan mt-1">Threat Heatmap</h3>
                <p className="text-white/60 text-sm mt-1">View live global attack markers and real-time cyber feed updates.</p>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card content-surface p-4">
                <p className="text-white/50 text-xs uppercase tracking-[0.2em]">Threat Reputation Avg</p>
                <p className="text-3xl text-cyan mt-2">{metrics.threat_reputation_avg || 0}</p>
              </div>
              <div className="glass-card content-surface p-4">
                <p className="text-white/50 text-xs uppercase tracking-[0.2em]">Intel Profiles</p>
                <p className="text-3xl text-lime mt-2">{metrics.threat_intel?.length || 0}</p>
              </div>
              <div className="glass-card content-surface p-4">
                <p className="text-white/50 text-xs uppercase tracking-[0.2em]">Scan Status</p>
                <p className={`text-3xl mt-2 ${metrics.scan_status?.healthy ? 'text-lime' : 'text-warning'}`}>{metrics.scan_status?.message || 'Monitoring active'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card content-surface p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/40">Threat Intel Spotlight</p>
                    <h2 className="font-display text-xl text-cyan mt-1">Live enrichment from external intel sources</h2>
                  </div>
                  <button onClick={() => navigate('/threat-intel')} className="px-3 py-2 rounded border border-cyan/30 text-cyan text-sm hover:bg-cyan/10">
                    Open Intel Lookup
                  </button>
                </div>
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {threatIntelData.length ? threatIntelData.map((profile) => (
                    <div key={profile.ip} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-white font-medium">{profile.ip}</p>
                          <p className="text-white/50 text-xs">ASN {profile.asn} | {profile.country}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] border ${profile.malicious ? 'border-danger/40 bg-danger/10 text-danger' : 'border-lime/40 bg-lime/10 text-lime'}`}>
                          {profile.malicious ? 'Malicious' : 'Watch'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs text-white/70">
                        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                          <p className="text-white/40 uppercase tracking-[0.18em]">Score</p>
                          <p className="text-cyan mt-1">{profile.threat_reputation_score}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                          <p className="text-white/40 uppercase tracking-[0.18em]">Tor</p>
                          <p className="text-lime mt-1">{profile.is_tor ? 'Yes' : 'No'}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                          <p className="text-white/40 uppercase tracking-[0.18em]">Proxy</p>
                          <p className="text-lime mt-1">{profile.is_proxy ? 'Yes' : 'No'}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                          <p className="text-white/40 uppercase tracking-[0.18em]">VPN</p>
                          <p className="text-lime mt-1">{profile.is_vpn ? 'Yes' : 'No'}</p>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-white/60">
                      No threat-intel profiles yet. Trigger a threat hunt or use the Threat Intel lookup page to populate the dashboard.
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card content-surface p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/40">Security Reports</p>
                    <h2 className="font-display text-xl text-lime mt-1">Ready-to-generate SOC reports</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-white/50 text-xs uppercase tracking-[0.2em]">Ready items</p>
                    <p className="text-2xl text-white">{reportReadyCount}</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/45 uppercase tracking-[0.18em] text-[11px]">Vulnerability history</p>
                    <p className="text-white text-lg mt-1">{metrics.total_scans} source scans recorded</p>
                    <p className="text-white/60 text-sm mt-1">Use the AI Analyst page to scan code and feed a vulnerability PDF report.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <p className="text-white/45 uppercase tracking-[0.18em] text-[11px]">Incident workflow</p>
                    <p className="text-white text-lg mt-1">{metrics.total_threats} threat events detected</p>
                    <p className="text-white/60 text-sm mt-1">Use the Incident Response page to generate a downloadable incident report.</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {reportActions.map((item) => (
                      <button key={item.label} onClick={item.action} className="rounded-xl border border-cyan/25 bg-cyan/5 p-3 text-left hover:bg-cyan/10 transition">
                        <p className="text-cyan font-medium">{item.label}</p>
                        <p className="text-white/60 text-sm mt-1">{item.helper}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <SeverityChart data={severityData} />
              <div className="glass-card p-4 h-72">
                <h2 className="font-display text-lg mb-3 text-cyan">Attack Trend</h2>
                <ResponsiveContainer width="100%" height="88%">
                  <AreaChart data={attackTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#244" />
                    <XAxis dataKey="bucket" stroke="#8dd" />
                    <YAxis stroke="#8dd" />
                    <Tooltip contentStyle={{ background: '#0b1224', border: '1px solid #00f5d4' }} />
                    <Area type="monotone" dataKey="count" stroke="#00f5d4" fill="#00f5d420" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <AlertTicker alerts={alerts.length ? alerts : metrics?.recent_threats || []} />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 xl:col-span-2">
            <h2 className="font-display text-lg text-lime mb-3">AI Recommendation Panel</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2 text-sm text-white/80">
                {metrics?.ai_recommendations?.map((item, index) => (
                  <div key={index} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    {typeof item === 'object' && item !== null ? (item.text ?? JSON.stringify(item)) : item}
                  </div>
                ))}
                {!metrics?.ai_recommendations?.length ? <p>No recommendations available.</p> : null}
              </div>
              <div className="space-y-3">
                <h3 className="font-display text-base text-cyan">Risk Heatmap</h3>
                <div className="grid gap-2" style={{ gridTemplateColumns: `120px repeat(${Math.max(1, heatmapTimes.length)}, minmax(0, 1fr))` }}>
                  <div />
                  {heatmapTimes.map((time) => (
                    <div key={time} className="text-[10px] uppercase tracking-[0.2em] text-white/50 text-center">
                      {time}
                    </div>
                  ))}
                  {heatmapSeverities.map((severity) => (
                    <div key={severity} className="contents">
                      <div key={`${severity}-label`} className="text-xs uppercase tracking-[0.2em] text-white/60 py-2">
                        {severity}
                      </div>
                      {heatmapTimes.map((time) => {
                        const value = heatmapLookup.get(`${time}-${severity}`) || 0;
                        return (
                          <div
                            key={`${time}-${severity}`}
                            className="h-10 rounded-xl border border-white/10 flex items-center justify-center text-xs text-white"
                            style={{ background: heatmapIntensity(value) }}
                          >
                            {value}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {metrics?.threat_intel?.length ? (
                  <div className="mt-4 space-y-2">
                    <h3 className="font-display text-base text-cyan">Recent Threat Intel</h3>
                    {metrics?.threat_intel?.map((profile) => (
                      <div key={profile.ip} className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white">{profile.ip}</span>
                          <span className={profile.malicious ? 'text-danger' : 'text-lime'}>{profile.threat_reputation_score}</span>
                        </div>
                        <p className="text-white/60 mt-1">ASN {profile.asn} | {profile.country} | Tor {profile.is_tor ? 'yes' : 'no'} | Proxy {profile.is_proxy ? 'yes' : 'no'} | VPN {profile.is_vpn ? 'yes' : 'no'}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 space-y-2">
                  <h3 className="font-display text-base text-cyan">Module Activity Timeline</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={activityTimelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#244" />
                      <XAxis dataKey="module" stroke="#8dd" />
                      <YAxis stroke="#8dd" allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#0b1224', border: '1px solid #00f5d4' }} />
                      <Area type="monotone" dataKey="count" stroke="#7cf6ff" fill="#7cf6ff22" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {metrics?.recent_activity?.length ? (
                  <div className="mt-4 space-y-2">
                    <h3 className="font-display text-base text-cyan">Recent Module Activity</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {metrics?.recent_activity?.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white uppercase tracking-[0.15em] text-xs">{item.module}</span>
                            <span className="text-white/50 text-xs">{item.created_at}</span>
                          </div>
                          <p className="text-white/80 mt-2">{item.action}</p>
                          <p className="text-white/45 text-xs mt-1">{item.request_path} | {item.ip_address} | {item.status_code}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
