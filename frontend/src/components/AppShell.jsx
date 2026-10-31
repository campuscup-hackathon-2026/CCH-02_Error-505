import { motion } from 'framer-motion';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Radar, FlaskConical, Siren, Bot, LogOut, Mic, CircleCheckBig, TriangleAlert, CircleSlash2, RefreshCw, ArrowUpRight, Database, ShieldAlert, ScrollText, Biohazard, Globe2, Bell, Zap, Radio, ScanLine, Waypoints } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useState, useEffect, useRef } from 'react';
import { createAlertsSocket } from '../lib/socket';
import { getEnterpriseDashboard } from '../lib/dashboard';
import AnimatedDataBackground from './AnimatedDataBackground';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Shield },
  { to: '/new-ui', label: 'New UI', icon: Globe2 },
  { to: '/analyst', label: 'AI Analyst', icon: FlaskConical },
  { to: '/vulnerability-intelligence', label: 'Vuln Intel', icon: Database },
  { to: '/threat-intel', label: 'Threat Intel', icon: Radar },
  { to: '/prompt-firewall', label: 'Prompt Firewall', icon: Radar },
  { to: '/threat-hunter', label: 'Threat Hunter', icon: Siren },
  { to: '/attack-simulator', label: 'Attack Simulator', icon: TriangleAlert },
  { to: '/unidirectional-defense', label: 'Unidirectional Defense · SIH26145', icon: Waypoints },
  { to: '/phishing-detector', label: 'Phishing', icon: ShieldAlert },
  { to: '/log-analyzer', label: 'Log Analyzer', icon: ScrollText },
  { to: '/malware-analyzer', label: 'Malware', icon: Biohazard },
  { to: '/threat-map', label: 'Threat Map', icon: Globe2 },
  { to: '/command-center', label: 'Command Center', icon: Zap },
  { to: '/lockdown-mode', label: 'Lockdown', icon: Radio },
  { to: '/voice-assistant', label: 'Voice Assistant', icon: Mic },
  { to: '/incident-response', label: 'Incident Response', icon: Shield },
  { to: '/copilot', label: 'Security Copilot', icon: Bot },
];

function displayValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

export default function AppShell({ children }) {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [moduleStatuses, setModuleStatuses] = useState([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [securityMode, setSecurityMode] = useState('MONITORING');
  const [clock, setClock] = useState(new Date());
  const moduleRefreshHandle = useRef(0);
  const moduleRefreshQueued = useRef(false);

  function pushToast(toast) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [{ id, ...toast }, ...prev].slice(0, 5));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 5000);
  }

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const r = new SpeechRecognition();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;
    r.onstart = () => setIsListening(true);
    r.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      try {
        const { data } = await api.post('/copilot/chat', { message: text });
        // speak response
          const utter = new SpeechSynthesisUtterance(typeof data === 'string' ? data : data?.answer || JSON.stringify(data));
        window.speechSynthesis.speak(utter);
      } catch (error) {
        console.error('Error sending message to copilot:', error);
        const utter = new SpeechSynthesisUtterance("I'm sorry, I'm having trouble connecting to the copilot.");
        window.speechSynthesis.speak(utter);
      }
    };
    r.onerror = (e) => {
      console.error('Speech recognition error', e);
      setIsListening(false);
    };
    r.onend = () => setIsListening(false);
    setRecognition(r);
    return () => {
      if (r) {
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        r.onstart = null;
        try { r.abort(); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const loadMode = async () => {
      try {
        const { data } = await api.get('/security-center/state');
        if (!alive) return;
        setSecurityMode(data?.mode || 'MONITORING');
      } catch {
        // leave default mode when offline or unauthenticated
      }
    };

    loadMode();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.body.dataset.securityMode = String(securityMode || 'MONITORING').toLowerCase();
    return () => {
      delete document.body.dataset.securityMode;
    };
  }, [securityMode]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    const loadModuleStatuses = async () => {
      setStatusLoading(true);
      try {
        const data = await getEnterpriseDashboard();
        if (!alive) return;
        setModuleStatuses(data?.module_statuses || []);
        setStatusError('');
      } catch (error) {
        if (!alive) return;
        setStatusError('Status feed unavailable');
      } finally {
        if (alive) setStatusLoading(false);
      }
    };

    const scheduleModuleReload = () => {
      if (moduleRefreshQueued.current) return;
      moduleRefreshQueued.current = true;
      moduleRefreshHandle.current = window.setTimeout(() => {
        moduleRefreshQueued.current = false;
        void loadModuleStatuses();
      }, 180);
    };

    loadModuleStatuses();
    const timer = window.setInterval(loadModuleStatuses, 30000);
    const socket = createAlertsSocket((evt) => {
      if (evt?.channel === 'module_status_update' || evt?.channel === 'threat_alert' || evt?.channel === 'simulation_alert' || evt?.channel === 'attack_simulation') {
        scheduleModuleReload();
      }
      if (evt?.channel === 'notification' && evt.payload) {
        pushToast(evt.payload);
      }
      if (evt?.channel === 'security_mode_update' && evt.payload?.mode) {
        setSecurityMode(evt.payload.mode);
      }
      if (evt?.channel === 'lockdown_state' && evt.payload?.mode) {
        setSecurityMode(evt.payload.mode);
        pushToast({ title: '⚠ Lockdown mode engaged', message: 'Emergency defense mode is active.', tone: 'critical' });
      }
      if (evt?.channel === 'attack_simulation' && evt.payload) {
        pushToast({ title: `⚠ ${evt.payload.attack}`, message: `${evt.payload.severity} risk on ${evt.payload.target}`, tone: evt.payload.severity.toLowerCase() });
      }
      if (evt?.channel === 'threat_feed_update' && evt.payload) {
        pushToast({ title: `⚠ ${evt.payload.severity} feed`, message: evt.payload.headline, tone: evt.payload.severity.toLowerCase() });
      }
    });

    return () => {
      alive = false;
      window.clearInterval(timer);
      if (moduleRefreshHandle.current) {
        window.clearTimeout(moduleRefreshHandle.current);
        moduleRefreshHandle.current = 0;
        moduleRefreshQueued.current = false;
      }
      if (typeof socket.safeClose === 'function') {
        socket.safeClose();
      } else {
        socket.close();
      }
    };
  }, []);

  const handleMicClick = () => {
    if (!recognition) return;
    if (isListening) {
      try { recognition.stop(); } catch {}
      setIsListening(false);
    } else {
      try {
        recognition.start();
      } catch {
        try { recognition.abort(); } catch {}
        window.setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 150);
      }
    }
  };

  const statusIcon = (state) => {
    if (state === 'healthy') return <CircleCheckBig size={16} className="text-emerald-400" />;
    if (state === 'warning') return <TriangleAlert size={16} className="text-amber-400" />;
    if (state === 'error') return <TriangleAlert size={16} className="text-rose-400" />;
    return <CircleSlash2 size={16} className="text-white/35" />;
  };

  const statusTone = (state) => {
    if (state === 'healthy') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    if (state === 'warning') return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    if (state === 'error') return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
    return 'border-white/10 bg-white/5 text-white/60';
  };

  const formatLastSeen = (value) => {
    if (!value) return 'Idle';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Idle';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const moduleRoutes = {
    vulnerability_intelligence: '/vulnerability-intelligence',
    ai_analyst: '/analyst',
    prompt_firewall: '/prompt-firewall',
    threat_hunter: '/threat-hunter',
    attack_simulator: '/attack-simulator',
    phishing_detector: '/phishing-detector',
    log_analyzer: '/log-analyzer',
    malware_analyzer: '/malware-analyzer',
    threat_map: '/threat-map',
    command_center: '/command-center',
    lockdown_mode: '/lockdown-mode',
    voice_assistant: '/voice-assistant',
    incident_response: '/incident-response',
    ai_copilot: '/copilot',
    threat_intel: '/threat-intel',
    reporting: '/',
  };

  const activeModule = Object.entries(moduleRoutes).find(([, route]) => {
    if (route === '/') return location.pathname === '/';
    return location.pathname.startsWith(route);
  })?.[0];

  const activeAlertCount = moduleStatuses.reduce((count, module) => count + (module.state === 'error' || module.state === 'warning' ? 1 : 0), 0)
    + toasts.filter((toast) => toast.tone === 'critical' || toast.tone === 'high').length;

  const modeTone = securityMode === 'LOCKDOWN' ? 'text-rose-300' : securityMode === 'DEFENSE' ? 'text-orange-300' : securityMode === 'SAFE' ? 'text-emerald-300' : 'text-cyan';

  return (
    <div className={`h-screen overflow-hidden flex app-shell mode-${String(securityMode || 'monitoring').toLowerCase()}`}>
      <AnimatedDataBackground />
      <div className="fixed bottom-3 left-3 right-3 z-50 lg:hidden glass-card p-2 flex items-center justify-between gap-1">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 text-center text-xs rounded p-2 border ${
                isActive ? 'border-cyan text-cyan bg-cyan/10' : 'border-cyan/20 text-white/80'
              }`
            }
          >
            {item.label.split(' ')[0]}
          </NavLink>
        ))}
      </div>

      <aside className={`relative z-10 hidden lg:flex h-screen min-h-0 overflow-y-auto overscroll-contain flex-col gap-4 p-4 border-r border-cyan/20 bg-black/25 backdrop-blur-xl transition-all duration-300 ${sidebarCollapsed ? 'w-24' : 'w-72'}`}>
        <div className="glass-card border border-cyan/15 p-3 flex items-center justify-between gap-3">
          <Link to="/" className={`font-display text-cyan tracking-wider ${sidebarCollapsed ? 'text-base' : 'text-2xl'}`}>
            {sidebarCollapsed ? 'SAI' : 'SentinelAI OS'}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            className="rounded-full border border-cyan/25 bg-cyan/10 p-2 text-cyan hover:bg-cyan/20 transition"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ScanLine size={16} className="animate-pulse" />
          </button>
        </div>
        <div className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${
                  isActive ? 'border-cyan bg-cyan/15 text-cyan shadow-neon shadow-cyan/20' : 'border-cyan/15 hover:border-cyan/60 hover:bg-white/5'
                }`
              }
            >
              <item.icon size={18} className="shrink-0 transition-transform duration-300 group-hover:scale-110" />
              {!sidebarCollapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
            </NavLink>
          ))}
        </div>
        <div className="mt-auto terminal-box text-lime space-y-1">
          <p className="uppercase tracking-[0.2em] text-white/40 text-[10px]">Operator</p>
          <p className="truncate">{user?.full_name}</p>
          <p className="text-white/70">{user?.role}</p>
        </div>
        <button onClick={logout} className="mt-4 flex items-center justify-center gap-2 p-3 rounded-lg border border-danger/70 text-danger hover:bg-danger/10">
          <LogOut size={16} />
          {!sidebarCollapsed ? 'Logout' : null}
        </button>
      </aside>

      <main className="relative z-10 h-screen flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 md:p-6 lg:p-8 pb-24 lg:pb-8 isolate">
        <div className="absolute inset-0 pointer-events-none cyber-scan-overlay" />
        <div className="absolute inset-0 pointer-events-none cyber-noise-overlay" />
        <div className="absolute inset-0 pointer-events-none floating-particles" />
        <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm pointer-events-none">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 30, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30 }}
              className={`pointer-events-auto rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${toast.tone === 'critical' ? 'border-rose-500/40 bg-rose-500/15' : toast.tone === 'high' ? 'border-orange-500/40 bg-orange-500/15' : toast.tone === 'medium' ? 'border-amber-500/40 bg-amber-500/15' : 'border-cyan/30 bg-cyan/10'}`}
            >
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">Security Notification</p>
              <p className="mt-1 font-semibold text-white">{displayValue(toast.title)}</p>
              <p className="text-sm text-white/80 mt-1 whitespace-pre-wrap">{displayValue(toast.message)}</p>
            </motion.div>
          ))}
        </div>
        <div className="mb-4 glass-card border border-cyan/15 px-4 py-3 backdrop-blur-2xl">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em] ${securityMode === 'LOCKDOWN' ? 'border-rose-500/40 bg-rose-500/15 text-rose-100' : securityMode === 'DEFENSE' ? 'border-orange-500/40 bg-orange-500/15 text-orange-100' : 'border-cyan/25 bg-cyan/10 text-cyan'}`}>
                <span className={`h-2 w-2 rounded-full ${securityMode === 'LOCKDOWN' ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                Live system status
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em] ${modeTone} border-white/10 bg-black/25`}>
                <span className="radar-dot" />
                Threat level {securityMode}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/70">
                <Bell size={12} className="text-cyan" />
                {activeAlertCount} active alerts
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/70">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 justify-end">
              <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <button onClick={handleMicClick} className="inline-flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan/10 px-3 py-2 text-cyan hover:bg-cyan/20 transition">
                <Mic size={16} />
                Voice
              </button>
              <button onClick={() => navigate('/lockdown-mode')} className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-100 hover:bg-rose-500/20 transition">
                <Radio size={16} className="animate-pulse" />
                Emergency Lockdown
              </button>
              <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                {user?.full_name || 'Operator'}
              </div>
            </div>
          </div>
        </div>
        <div className="mb-5 glass-card content-surface border border-cyan/15 p-3 md:p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/40">Module status</p>
              <p className="text-sm text-white/70">Live health and last execution across the platform</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/45">
              {statusLoading ? <RefreshCw size={14} className="animate-spin" /> : <CircleCheckBig size={14} />}
              <span>{statusError || 'Auto-refreshing every 30s'}</span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            {moduleStatuses.length > 0 ? moduleStatuses.map((module) => (
              <button
                key={module.module}
                type="button"
                onClick={() => navigate(moduleRoutes[module.module] || '/')}
                title={`Open ${module.label}`}
                className={`rounded-xl border px-3 py-2 backdrop-blur-sm text-left transition hover:-translate-y-0.5 hover:shadow-lg ${statusTone(module.state)} ${activeModule === module.module ? 'ring-2 ring-cyan/60 shadow-neon scale-[1.01]' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon(module.state)}
                    <span className="text-sm font-medium truncate">{displayValue(module.label)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ArrowUpRight size={12} className="opacity-70" />
                    <span className="text-[10px] uppercase tracking-[0.2em] opacity-70">{module.state}</span>
                    {activeModule === module.module ? (
                      <span className="animate-pulse rounded-full border border-cyan/40 bg-cyan/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-cyan">
                        Current
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 text-xs text-white/60 flex items-center justify-between gap-2">
                  <span>{formatLastSeen(module.last_seen_at)}</span>
                  <span>{module.last_status_code ? `HTTP ${module.last_status_code}` : 'No activity'}</span>
                </div>
              </button>
            )) : (
              <div className="col-span-full rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-white/50">
                No module activity yet. Run a scan, open Copilot, or trigger an incident workflow to populate live status.
              </div>
            )}
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {children}
        </motion.div>
      </main>
    </div>
  );
}
