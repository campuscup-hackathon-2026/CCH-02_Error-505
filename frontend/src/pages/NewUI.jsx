import { useState, useEffect } from 'react';
import AppShell from '../components/AppShell';
import KpiCard from '../components/KpiCard';
import SecurityScoreMeter from '../components/SecurityScoreMeter';

export default function NewUI() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // lightweight demo data for the new UI; real data can be wired to existing APIs
    setData({
      security_score: 78,
      total_threats: 12,
      active_scans: 3,
      ai_recommendations: 5,
      recent_events: [
        { id: 1, title: 'Suspicious login', time: '2m ago', severity: 'high' },
        { id: 2, title: 'Failed deployment scan', time: '8m ago', severity: 'medium' },
      ],
    });
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl text-cyan">New UI — SentinelAI Experience</h1>
          <p className="text-white/70">A refreshed, focused operator workspace with consolidated controls and insights.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <div className="glass-card p-4">
              <h2 className="font-display text-xl text-lime">Overview</h2>
              <p className="text-white/60 mt-2">A quick summary of key security posture metrics and recent events.</p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCard title="Security Score" value={data?.security_score ?? '—'} />
                <KpiCard title="Active Threats" value={data?.total_threats ?? 0} accent="danger" />
                <KpiCard title="Active Scans" value={data?.active_scans ?? 0} />
              </div>
            </div>

            <div className="glass-card p-4">
              <h3 className="font-display text-lg text-cyan">Recent Events</h3>
              <div className="mt-3 space-y-2">
                {data?.recent_events?.map((evt) => (
                  <div key={evt.id} className="rounded-xl border border-white/10 p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{evt.title}</p>
                      <p className="text-white/60 text-sm">{evt.time} • {evt.severity}</p>
                    </div>
                    <div className="text-sm text-white/50">View</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="glass-card p-4 text-center">
              <p className="text-xs uppercase text-white/40">Security Score</p>
              <div className="mt-3">
                <SecurityScoreMeter score={data?.security_score ?? 0} />
              </div>
            </div>

            <div className="glass-card p-4">
              <h4 className="text-sm text-white/60">AI Recommendations</h4>
              <p className="text-cyan font-medium mt-2">{data?.ai_recommendations ?? 0} suggested actions</p>
            </div>
          </aside>
        </div>

        <div className="glass-card p-4">
          <h3 className="font-display text-lg text-cyan">Control Center</h3>
          <p className="text-white/60 mt-2">Quick actions for common workflows.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="px-4 py-2 rounded bg-cyan text-black font-semibold">Run Scan</button>
            <button className="px-4 py-2 rounded border border-cyan text-cyan">Open Copilot</button>
            <button className="px-4 py-2 rounded border border-warning text-warning">Trigger Lockdown</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
