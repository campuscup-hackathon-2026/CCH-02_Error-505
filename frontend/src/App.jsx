import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AIRecommendations = lazy(() => import('./pages/AIRecommendations'));
const Analyst = lazy(() => import('./pages/Analyst'));
const AttackSimulator = lazy(() => import('./pages/AttackSimulator'));
const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const Copilot = lazy(() => import('./pages/Copilot'));
const IncidentResponse = lazy(() => import('./pages/IncidentResponse'));
const IntegrityMonitor = lazy(() => import('./pages/IntegrityMonitor'));
const LiveAttackFeed = lazy(() => import('./pages/LiveAttackFeed'));
const LockdownMode = lazy(() => import('./pages/LockdownMode'));
const LogAnalyzer = lazy(() => import('./pages/LogAnalyzer'));
const Login = lazy(() => import('./pages/Login'));
const MalwareAnalyzer = lazy(() => import('./pages/MalwareAnalyzer'));
const NewUI = lazy(() => import('./pages/NewUI'));
const PhishingDetector = lazy(() => import('./pages/PhishingDetector'));
const PromptFirewall = lazy(() => import('./pages/PromptFirewall'));
const Register = lazy(() => import('./pages/Register'));
const SocActivityFeed = lazy(() => import('./pages/SocActivityFeed'));
const TerminalConsole = lazy(() => import('./pages/TerminalConsole'));
const ThreatHunter = lazy(() => import('./pages/ThreatHunter'));
const ThreatIntel = lazy(() => import('./pages/ThreatIntel'));
const ThreatMap = lazy(() => import('./pages/ThreatMap'));
const ThreatPrediction = lazy(() => import('./pages/ThreatPrediction'));
const UnidirectionalTraffic = lazy(() => import('./pages/UnidirectionalTraffic'));
const VoiceAssistant = lazy(() => import('./pages/VoiceAssistant'));
const VulnerabilityIntelligence = lazy(() => import('./pages/VulnerabilityIntelligence'));

const pages = [
  ['/', Dashboard], ['/dashboard', Dashboard], ['/new-ui', NewUI], ['/analyst', Analyst],
  ['/vulnerability-intelligence', VulnerabilityIntelligence], ['/threat-intel', ThreatIntel],
  ['/prompt-firewall', PromptFirewall], ['/threat-hunter', ThreatHunter],
  ['/attack-simulator', AttackSimulator], ['/unidirectional-defense', UnidirectionalTraffic],
  ['/phishing-detector', PhishingDetector], ['/log-analyzer', LogAnalyzer],
  ['/malware-analyzer', MalwareAnalyzer], ['/threat-map', ThreatMap],
  ['/command-center', CommandCenter], ['/lockdown-mode', LockdownMode],
  ['/voice-assistant', VoiceAssistant], ['/incident-response', IncidentResponse],
  ['/copilot', Copilot], ['/integrity-monitor', IntegrityMonitor],
  ['/live-attack-feed', LiveAttackFeed], ['/soc-activity', SocActivityFeed],
  ['/threat-prediction', ThreatPrediction], ['/ai-recommendations', AIRecommendations],
  ['/terminal', TerminalConsole],
];

function SecurePage({ component: Page }) {
  return <ProtectedRoute><Page /></ProtectedRoute>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="min-h-screen grid place-items-center text-cyan">Loading secure workspace...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {pages.map(([path, component]) => (
            <Route key={path} path={path} element={<SecurePage component={component} />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
