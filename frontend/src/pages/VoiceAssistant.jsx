import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Radio, Send, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { initiateLockdown } from '../lib/securityCenter';

const COMMANDS = [
  { label: 'Show active threats', terms: ['active threat', 'live attack', 'attack feed', 'show threat'], response: 'Opening live attack feed.', action: '/live-attack-feed' },
  { label: 'Start security scan', terms: ['security scan', 'start scan', 'ai analyst', 'run scan'], response: 'Launching AI Analyst scan.', action: '/analyst' },
  { label: 'Enable lockdown', terms: ['enable lockdown', 'start lockdown', 'emergency lockdown', 'lock down'], response: 'Enabling lockdown mode now.', action: 'lockdown' },
  { label: 'Generate incident report', terms: ['incident report', 'incident response', 'generate report'], response: 'Opening incident response workflow.', action: '/incident-response' },
  { label: 'Show malware alerts', terms: ['malware alert', 'malware analyzer', 'show malware'], response: 'Displaying malware analyzer.', action: '/malware-analyzer' },
];

function normalizeCommand(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findCommand(value) {
  const normalized = normalizeCommand(value);
  return COMMANDS.find((item) => item.terms.some((term) => normalized.includes(term)));
}

export default function VoiceAssistant() {
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('Say a command to control the SOC.');
  const [status, setStatus] = useState('Idle');
  const [supported, setSupported] = useState(true);
  const [manualCommand, setManualCommand] = useState('');

  function speak(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  async function executeCommand(text) {
    const matched = findCommand(text);
    if (!matched) {
      const fallback = 'Command not recognized. Try a supported SOC phrase.';
      setResponse(fallback);
      setStatus('No action taken');
      speak(fallback);
      return;
    }

    setResponse(matched.response);
    setStatus('Executing');
    speak(matched.response);
    try {
      if (matched.action === 'lockdown') {
        await initiateLockdown();
        navigate('/lockdown-mode');
      } else {
        navigate(matched.action);
      }
      setStatus('Completed');
    } catch {
      const failure = 'Command failed. Check backend connectivity and try again.';
      setResponse(failure);
      setStatus('Action failed');
      speak(failure);
    }
  }

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      setStatus('Speech recognition unavailable');
      setResponse('Use Chrome or Edge on localhost or HTTPS and allow microphone access.');
      return;
    }

    const r = new SpeechRecognition();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;

    r.onstart = () => {
      setListening(true);
      setStatus('Listening for command');
    };

    r.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      await executeCommand(text);
    };

    r.onerror = (event) => {
      const error = event?.error || 'unknown';
      const message = error === 'not-allowed'
        ? 'Microphone permission denied. Allow microphone access in the browser.'
        : error === 'no-speech'
          ? 'No speech detected. Try again closer to the microphone.'
          : `Speech recognition error: ${error}`;
      setStatus('Listening error');
      setResponse(message);
      setListening(false);
    };

    r.onend = () => {
      setListening(false);
    };

    recognitionRef.current = r;
    return () => {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      r.onstart = null;
      try { r.abort(); } catch {}
      recognitionRef.current = null;
    };
  }, [navigate]);

  function toggleListening() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setStatus('Speech recognition unavailable');
      return;
    }
    if (listening) {
      try { recognition.stop(); } catch {}
      setListening(false);
      setStatus('Listening stopped');
    } else {
      setTranscript('');
      try {
        recognition.start();
      } catch {
        setStatus('Restarting microphone');
        try { recognition.abort(); } catch {}
        window.setTimeout(() => {
          try { recognition.start(); } catch {
            setStatus('Unable to start microphone');
          }
        }, 150);
      }
    }
  }

  async function runManualCommand(value = manualCommand) {
    const command = value.trim();
    if (!command) return;
    setTranscript(command);
    setManualCommand('');
    await executeCommand(command);
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="glass-card p-5 border border-cyan/15">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">Voice-Controlled Security Assistant</p>
          <h1 className="font-display text-3xl text-cyan mt-2">Browser-native SOC command control</h1>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={toggleListening}
          disabled={!supported}
          className={`w-full rounded-3xl border-2 p-8 font-display text-3xl tracking-[0.3em] ${listening ? 'border-rose-500/60 bg-rose-500/15 text-rose-100 animate-pulse' : 'border-cyan/50 bg-cyan/10 text-cyan'}`}
        >
          {listening ? <MicOff className="mx-auto mb-3" size={36} /> : <Mic className="mx-auto mb-3" size={36} />}
          {listening ? 'STOP LISTENING' : 'START SECURITY VOICE'}
        </motion.button>

        <div className="glass-card border border-cyan/15 p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={manualCommand}
              onChange={(event) => setManualCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void runManualCommand();
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-cyan/25 bg-black/35 px-3 py-3 text-white outline-none focus:border-cyan"
              placeholder="Type a command if the microphone is blocked..."
            />
            <button
              type="button"
              onClick={() => void runManualCommand()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan/40 bg-cyan/15 px-4 py-3 text-cyan hover:bg-cyan/25"
            >
              <Send size={16} />
              Run
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {COMMANDS.map((command) => (
              <button
                key={command.label}
                type="button"
                onClick={() => void runManualCommand(command.label)}
                className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 hover:border-cyan/40 hover:text-cyan"
              >
                {command.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="glass-card p-4 border border-white/10 xl:col-span-2">
            <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Transcript</p>
            <p className="mt-2 text-lg text-white">{transcript || 'Waiting for voice input...'}</p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">AI response</p>
              <p className="text-white/80">{response}</p>
            </div>
          </div>

          <div className="glass-card p-4 border border-white/10 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Execution status</p>
              <p className="text-2xl text-lime-200 mt-2">{status}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3 terminal-box">
              {COMMANDS.map((command) => (
                <p key={command.label} className="text-lime-200">&gt; {command.label}</p>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3 flex items-center gap-2 text-white/70 text-sm">
              <ShieldCheck size={16} className="text-cyan" /> SpeechRecognition API only, no cloud AI.
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3 flex items-center gap-2 text-white/70 text-sm">
              <Radio size={16} className="text-rose-300" /> Supports lockdown and navigation commands.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
