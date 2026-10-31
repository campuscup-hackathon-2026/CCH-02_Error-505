import { useCallback, useEffect, useState } from 'react';
import { Activity, FileUp, Pause, Play, RotateCcw, ShieldCheck, Square } from 'lucide-react';
import AppShell from '../components/AppShell';
import KpiCard from '../components/KpiCard';
import { api } from '../lib/api';

const scenarios = [['normal', 'Normal'], ['syn_flood', 'SYN Flood'], ['udp_amplification', 'UDP Amplification'], ['c2', 'C2 Beacon'], ['dga', 'DGA'], ['dns_tunnel', 'DNS Tunnel'], ['port_scan', 'Port Scan'], ['exfiltration', 'Exfiltration']];
const tone = { CRITICAL: 'text-danger border-danger/40 bg-danger/10', HIGH: 'text-warning border-warning/40 bg-warning/10', MEDIUM: 'text-warning border-warning/40 bg-warning/10', LOW: 'text-lime border-lime/40 bg-lime/10' };

export default function UnidirectionalTraffic() {
  const [data, setData] = useState(null);
  const [scenario, setScenario] = useState('normal');
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');
  const [interfaces, setInterfaces] = useState([]);
  const [liveInterface, setLiveInterface] = useState('');
  const [liveStatus, setLiveStatus] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: overview } = await api.get('/unidirectional/overview');
      setData(overview); setError('');
    } catch { setError('Passive traffic service is unavailable.'); }
  }, []);

  const control = async (path, payload) => {
    try {
      const { data: overview } = await api.post(`/unidirectional/demo/${path}`, payload);
      setData(overview); setError('');
    } catch { setError('Unable to update the offline demo.'); }
  };
  const uploadPcap = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const form = new FormData(); form.append('file', file);
    try { const { data: result } = await api.post('/unidirectional/analyze-pcap', form); setError(`${result.flows_analyzed} metadata-only flows analyzed; ${result.alerts_generated} alerts generated.`); await load(); }
    catch (err) { setError(err?.response?.data?.detail || 'PCAP analysis failed.'); }
    finally { event.target.value = ''; }
  };

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    Promise.all([api.get('/unidirectional/live/interfaces'), api.get('/unidirectional/live/status')]).then(([available, status]) => {
      if (!active) return; setInterfaces(available.data.interfaces || []); setLiveInterface(value => value || available.data.interfaces?.[0] || ''); setLiveStatus(status.data);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let socket; let retry; let disposed = false;
    const connect = () => { socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/ws/unidirectional`);
    socket.onopen = () => socket.send('subscribe');
    socket.onmessage = (event) => {
      try { const message = JSON.parse(event.data); if (message.channel === 'unidirectional_update') setData(message.payload); } catch { /* ignore malformed telemetry */ }
    };
    socket.onclose = () => { if (!disposed) retry = window.setTimeout(connect, 1500); };
    }; connect(); return () => { disposed = true; window.clearTimeout(retry); socket?.close(); };
  }, []);
  const liveControl = async (operation) => {
    try { const { data: result } = await api.post(`/unidirectional/live/${operation}`, operation === 'start' ? { interface: liveInterface } : undefined); setLiveStatus(result); setError(''); }
    catch (err) { setError(err?.response?.data?.detail || 'Unable to update passive live ingestion.'); }
  };

  const traffic = data?.traffic || {};
  const simulation = data?.simulation || {};
  const airGap = data?.air_gap || {};
  return <AppShell><div className="space-y-5">
    <div className="glass-card content-surface p-5 border border-cyan/25">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-xs uppercase tracking-[.28em] text-white/45">SIH26145 · DATA DIODE DEFENSE ENGINE</p><h1 className="font-display text-3xl md:text-4xl text-cyan mt-2">Unidirectional Defense</h1><p className="text-white/65 mt-2 max-w-3xl">AI-Powered Passive Traffic Intelligence: read-only ingest, no return path, metadata-only streaming analysis.</p></div>
        <div className="flex flex-wrap gap-2"><label className="px-3 py-2 rounded border border-cyan/40 text-cyan cursor-pointer"><FileUp size={16} className="inline mr-1"/>Analyze PCAP<input className="hidden" type="file" accept=".pcap,.pcapng,.cap" onChange={uploadPcap}/></label><button onClick={() => control('start', { scenario, speed })} className="px-4 py-2 rounded bg-cyan text-black font-semibold inline-flex gap-2"><Play size={16}/>Start demo</button><button onClick={() => control('pause')} className="px-3 py-2 rounded border border-warning/40 text-warning"><Pause size={16}/></button><button onClick={() => control('stop')} className="px-3 py-2 rounded border border-danger/40 text-danger"><Square size={16}/></button><button onClick={() => control('reset')} className="px-3 py-2 rounded border border-white/20 text-white/75"><RotateCcw size={16}/></button></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{scenarios.map(([id, label]) => <button key={id} onClick={() => setScenario(id)} className={`rounded-full px-3 py-1 text-xs border ${scenario === id ? 'border-cyan bg-cyan/15 text-cyan' : 'border-white/15 text-white/65'}`}>{label}</button>)}{[0.5,1,2,5].map((value) => <button key={value} onClick={() => setSpeed(value)} className={`rounded-full px-3 py-1 text-xs border ${speed === value ? 'border-lime bg-lime/10 text-lime' : 'border-white/15 text-white/65'}`}>{value}x</button>)}</div>
    </div>
    {error && <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-danger">{error}</div>}
    <section className="glass-card border border-cyan/20 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-white/45">Live passive feed</p><h2 className="mt-1 font-display text-xl text-cyan">Data-diode / TAP ingest NIC</h2><p className="mt-1 text-xs text-white/55">Attach only an approved receive-only monitoring interface. SentinelAI does not transmit through this interface.</p></div><div className="flex flex-wrap gap-2"><select value={liveInterface} onChange={e => setLiveInterface(e.target.value)} className="rounded border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"><option value="">Select interface</option>{interfaces.map(name => <option key={name} value={name}>{name}</option>)}</select><button disabled={!liveInterface || liveStatus?.status === 'LIVE'} onClick={() => liveControl('start')} className="rounded border border-lime/40 px-3 py-2 text-sm text-lime disabled:opacity-40">Start passive ingest</button><button disabled={liveStatus?.status !== 'LIVE'} onClick={() => liveControl('stop')} className="rounded border border-danger/40 px-3 py-2 text-sm text-danger disabled:opacity-40">Stop</button></div></div><p className="mt-3 text-xs text-lime">STATUS: {liveStatus?.status || 'STOPPED'} · queue depth: {liveStatus?.metrics?.queue_depth ?? 0} · packet injection: 0</p></section>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[['READ ONLY', airGap.read_only ? 'ACTIVE' : '—'], ['DIRECTION', airGap.direction || 'INBOUND ONLY'], ['RETURN PATH', airGap.return_path || 'BLOCKED'], ['ACTIVE PROBES', airGap.active_probes ?? 0], ['PAYLOAD DECRYPTION', airGap.payload_decryption || 'DISABLED']].map(([label,value]) => <div key={label} className="glass-card p-3 border border-lime/20"><p className="text-[10px] tracking-[.2em] text-white/45">{label}</p><p className="text-lime mt-1 font-semibold">{value}</p></div>)}</div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><KpiCard title="Packets / sec" value={traffic.packets_per_second || 0}/><KpiCard title="Bytes / sec" value={traffic.bytes_per_second || 0}/><KpiCard title="Active flows" value={traffic.active_flows || 0}/><KpiCard title="Alerts generated" value={data?.pipeline?.alerts_generated_total || 0} accent="cyan"/></div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4"><div className="glass-card p-4 xl:col-span-2"><div className="flex justify-between gap-3"><div><p className="text-xs uppercase tracking-[.2em] text-white/45">Live flow stream</p><h2 className="font-display text-xl text-cyan mt-1">Ingress metadata only</h2></div><span className="text-sm text-white/55">{simulation.mode || 'STOPPED'} · {simulation.scenario || 'normal'}</span></div><div className="mt-4 max-h-[360px] overflow-auto"><table className="w-full min-w-[620px] text-sm"><thead className="text-left text-white/40"><tr><th>Time</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Bytes</th><th>Rate</th></tr></thead><tbody>{(data?.flows || []).map((flow) => <tr key={flow.flow_id} className="border-t border-white/10 text-white/75"><td className="py-2">{new Date(flow.timestamp).toLocaleTimeString()}</td><td>{flow.source_ip}</td><td>{flow.destination_ip}</td><td className="text-cyan">{flow.protocol}</td><td>{flow.byte_count}</td><td className="text-lime">{Math.round(flow.packets_per_second)} pps</td></tr>)}</tbody></table></div></div>
      <div className="glass-card p-4"><p className="text-xs uppercase tracking-[.2em] text-white/45">Data diode boundary</p><h2 className="font-display text-xl text-lime mt-1">Observed communication only</h2><div className="mt-4 space-y-2 text-center text-sm"><p>PRODUCTION NETWORK</p><p className="text-cyan animate-pulse">↓</p><p className="rounded border border-cyan/40 bg-cyan/10 p-3 text-cyan">DATA DIODE · READ ONLY · → → →</p><p className="text-cyan animate-pulse">↓</p><p>SENTINELAI ANALYZER</p></div><div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/60"><ShieldCheck size={14} className="inline text-lime mr-2"/>No return path · payload decryption disabled</div></div></div>
    <div className="glass-card p-4"><p className="text-xs uppercase tracking-[.2em] text-white/45">Threat investigation queue</p><h2 className="font-display text-xl text-warning mt-1">Confidence and evidence</h2><div className="mt-4 space-y-3">{(data?.alerts || []).map((alert) => <div key={alert.alert_id} className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-white font-medium">{alert.threat_class}</p><span className={`rounded-full border px-2 py-0.5 text-xs ${tone[alert.severity]}`}>{alert.severity} · {Math.round(alert.confidence * 100)}%</span></div><p className="text-white/55 text-sm mt-1">{alert.source} → {alert.destination} · {alert.protocol}</p><p className="text-white/75 text-sm mt-2">{JSON.stringify(alert.evidence?.signals?.[0] || {})}</p><p className="text-cyan text-xs mt-2">{alert.model} · {alert.detection_method}</p></div>)}{!(data?.alerts || []).length && <p className="text-white/50 text-sm">No passive detections yet.</p>}</div></div>
  </div></AppShell>;
}
