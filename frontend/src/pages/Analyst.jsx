import { useState } from 'react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

const scanStages = [
  'Uploading source file',
  'Analyzing code patterns',
  'Scoring severity and risk',
  'Generating fixes and summary',
];

function displayValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

export default function Analyst() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');

async function onSubmit(e) {
  e.preventDefault();
  if (!file) return;
  setLoading(true);
  setError('');
  setResult(null);
  setProgress(0);

  let progressTimer = null;
  let stageTimer = null;

  const stopTimers = () => {
    if (progressTimer) window.clearInterval(progressTimer);
    if (stageTimer) window.clearInterval(stageTimer);
  };

  setStage(scanStages[0]);
  
  // Fake progress bar loop
  progressTimer = window.setInterval(() => {
    setProgress((current) => Math.min(92, current + 6));
  }, 250);

  // Fake stages loop
  let stageIndex = 0;
  stageTimer = window.setInterval(() => {
    stageIndex = Math.min(scanStages.length - 1, stageIndex + 1);
    setStage(scanStages[stageIndex]);
  }, 900);

  try {
    const formData = new FormData();
    formData.append('file', file);
    
    // Hit your newly working FastAPI CORS endpoint
    // Let the browser set the Content-Type including the multipart boundary header.
    const { data } = await api.post('/security/scan-code', formData, {
      timeout: 120000,
    });
    
    // Success: stop timers cleanly first, then map the data
    stopTimers();
    setProgress(100);
    setStage('Scan complete');
    setResult(data);
  } catch (err) {
    // Error: stop timers cleanly, map the error message
    stopTimers();
    setProgress(0);
    setStage('');
    
    // Grab the exact message from FastAPI if it exists
    setError(err.response?.data?.detail || 'Scan failed');
  } finally {
    // ONLY turn off the loading state here. Leave the timers alone!
    setLoading(false);
  }
}

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="font-display text-3xl text-cyan">AI Security Analyst Assistant</h1>
        <form onSubmit={onSubmit} className="glass-card p-4 space-y-4">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full" required />
          <button className="px-4 py-2 rounded bg-cyan text-black font-semibold" disabled={loading}>
            {loading ? 'Scanning for vulnerabilities...' : 'Run Secure Code Scan'}
          </button>
          {loading ? (
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan to-lime transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-white/70 text-sm">{stage || 'Preparing scan...'}</p>
            </div>
          ) : null}
          {error && <p className="text-danger text-sm">{error}</p>}
        </form>

        {result && (
          <div className="glass-card p-4 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <p>Risk Score: <span className="text-warning">{result.risk_score}</span></p>
              <p>Severity: <span className="uppercase text-danger">{result.severity_band || result.severity}</span></p>
              <p>Provider: <span className="text-cyan uppercase">{result.provider || 'fallback'}</span></p>
              <p>Findings: <span className="text-lime">{result.findings.length}</span></p>
            </div>
            <p className="text-white/80 whitespace-pre-wrap">{displayValue(result.ai_summary)}</p>
            <div className="terminal-box mt-2">
              <p className="text-lime mb-2">AI Fix Snippet</p>
              <pre className="whitespace-pre-wrap text-sm text-white/80">{displayValue(result.secure_fix_snippet)}</pre>
            </div>
            <div className="terminal-box mt-2">
              <p className="text-lime mb-2">Findings</p>
              {result.findings.map((f, i) => (
                <p key={i}>[{f.severity}] line {f.line} :: {f.type}</p>
              ))}
            </div>
            <div className="terminal-box mt-2">
              <p className="text-lime mb-2">Generated Fixes</p>
              {Object.entries(result.generated_fixes || {}).map(([line, fix]) => (
                <p key={line}>Line {line}: {displayValue(fix.suggestion)}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
