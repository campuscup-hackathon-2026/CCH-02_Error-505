import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { login, me } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const containerRef = useRef(null);
  const hackerRef = useRef(null);
  const { loginUser, setUser } = useAuth();
  const navigate = useNavigate();

  function normalizeError(err) {
    const detail = err.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            return item.msg || item.message || JSON.stringify(item);
          }
          return String(item);
        })
        .join(' | ');
    }
    if (typeof detail === 'string') {
      return detail;
    }
    if (detail && typeof detail === 'object') {
      return detail.msg || detail.message || JSON.stringify(detail);
    }
    return 'Authentication failed';
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await login({ email, password });
      loginUser(data.access_token);
      const profile = await me(data.access_token);
      setUser(profile);
      navigate('/');
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }

  // Subtle mouse parallax for hacker image
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!hackerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const offsetX = (e.clientX - (rect.left + centerX)) * 0.012;
      const offsetY = (e.clientY - (rect.top + centerY)) * 0.012;

      hackerRef.current.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full fixed inset-0 overflow-hidden"
      style={{
        background: '#020812'
      }}
    >
      {/* Full-scene cybersecurity background. */}
      <div ref={hackerRef} className="auth-scene-image" aria-hidden="true" />

      {/* BACKGROUND LAYER: Dark cybersecurity environment */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(90deg, rgba(2, 7, 13, 0.9) 0%, rgba(2, 12, 20, 0.58) 48%, rgba(2, 10, 17, 0.28) 100%)
          `,
          zIndex: 0
        }}
      />

      {/* Binary Code - Left Background */}
      <div
        className="absolute left-0 top-0 h-full pointer-events-none"
        style={{
          width: '140px',
          zIndex: 1,
          animation: 'binaryFlow 14s linear infinite',
          fontSize: '0.7rem',
          color: 'rgba(0, 240, 255, 0.12)',
          fontFamily: 'monospace',
          overflow: 'hidden',
          whiteSpace: 'pre',
          lineHeight: '1.5',
          padding: '30px 10px'
        }}
      >
        {`010101010101
110010101010
001101011010
101010010101
110101010011
001011101010
101010110101`}
      </div>

      {/* Binary Code - Center Background */}
      <div
        className="absolute left-1/2 top-0 h-full pointer-events-none"
        style={{
          width: '120px',
          transform: 'translateX(-50%)',
          zIndex: 1,
          animation: 'binaryFlow 16s linear infinite',
          fontSize: '0.65rem',
          color: 'rgba(0, 180, 220, 0.08)',
          fontFamily: 'monospace',
          overflow: 'hidden',
          whiteSpace: 'pre',
          lineHeight: '1.6',
          padding: '40px 10px'
        }}
      >
        {`11001010
01011010
10101001
11010101
00101110
10101011
01010110`}
      </div>

      {/* Continuous telemetry remains visible behind the authentication controls. */}
      <div className="auth-form-telemetry absolute pointer-events-none" aria-hidden="true">
        {`01010110 00101101 11001010
NETWORK 0x4A91 01011010
11010101 00110110 01010101
PACKET STREAM 0xAF21 10110010
01001010 11010101 00101110
AI ANALYSIS 01011010 00110110`}
      </div>

      {/* Binary Code - Right Background */}
      <div
        className="absolute right-0 top-0 h-full pointer-events-none"
        style={{
          width: '140px',
          zIndex: 1,
          animation: 'binaryFlowReverse 14s linear infinite',
          fontSize: '0.7rem',
          color: 'rgba(0, 240, 255, 0.12)',
          fontFamily: 'monospace',
          overflow: 'hidden',
          whiteSpace: 'pre',
          lineHeight: '1.5',
          padding: '30px 10px',
          textAlign: 'right'
        }}
      >
        {`101010101010
010101101010
110010010101
001011101010
101010011010
011010101010
101101010101`}
      </div>

      {/* Subtle Scanning Lines */}
      <div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(0, 235, 255, 0.15), transparent)',
          zIndex: 2,
          animation: 'scan 5s linear infinite',
          boxShadow: '0 0 10px rgba(0, 235, 255, 0.12)'
        }}
      />

      {/* HUD Labels - Top Left */}
      <div
        className="absolute top-20 left-8 pointer-events-none text-xs font-mono uppercase tracking-widest"
        style={{ zIndex: 3, color: 'rgba(0, 240, 255, 0.16)' }}
      >
        <div style={{ animation: 'hudFloat 6s ease-in-out infinite' }}>
          ▲ THREAT INTELLIGENCE
        </div>
        <div className="mt-16" style={{ animation: 'hudFloat 7s ease-in-out infinite 1s' }}>
          ▼ NETWORK MONITORING
        </div>
      </div>

      {/* HUD Labels - Top Right */}
      <div
        className="absolute top-20 right-8 pointer-events-none text-xs font-mono uppercase tracking-widest text-right"
        style={{ zIndex: 3, color: 'rgba(0, 240, 255, 0.16)' }}
      >
        <div style={{ animation: 'hudFloat 6.5s ease-in-out infinite 0.5s' }}>
          PACKET ANALYSIS ▼
        </div>
        <div className="mt-16" style={{ animation: 'hudFloat 7.5s ease-in-out infinite 1.5s' }}>
          ANOMALY DETECTED ▲
        </div>
      </div>

      {/* HUD Labels - Bottom Left */}
      <div
        className="absolute bottom-20 left-8 pointer-events-none text-xs font-mono uppercase tracking-widest"
        style={{ zIndex: 3, color: 'rgba(0, 240, 255, 0.16)' }}
      >
        <div style={{ animation: 'hudFloat 6.2s ease-in-out infinite 0.3s' }}>
          ▼ FLOW DETECTED
        </div>
        <div className="mt-12" style={{ animation: 'hudFloat 7.2s ease-in-out infinite 1.3s' }}>
          ▲ SECURITY EVENT
        </div>
      </div>

      {/* HUD Labels - Bottom Right */}
      <div
        className="absolute bottom-20 right-8 pointer-events-none text-xs font-mono uppercase tracking-widest text-right"
        style={{ zIndex: 3, color: 'rgba(0, 240, 255, 0.16)' }}
      >
        <div style={{ animation: 'hudFloat 6.3s ease-in-out infinite 0.7s' }}>
          SOC MONITORING ▲
        </div>
        <div className="mt-12" style={{ animation: 'hudFloat 7.3s ease-in-out infinite 1.7s' }}>
          ENCRYPTED CHANNEL ▼
        </div>
      </div>

      {/* LEFT SIDE: Login Panel Container */}
      <div
        className="auth-form-zone absolute left-1/2 top-0 h-full flex -translate-x-1/2 items-center justify-center pointer-events-none"
        style={{
          width: '420px',
          maxWidth: '88vw',
          zIndex: 10,
          paddingLeft: 0
        }}
      >

        {/* Login Form */}
        <form
          onSubmit={onSubmit}
          className="auth-login-card pointer-events-auto w-full"
          style={{
            background: 'linear-gradient(110deg, rgba(2, 12, 22, .34), rgba(2, 12, 22, .08))',
            border: '1px solid rgba(0, 200, 240, .22)',
            borderRadius: '14px',
            padding: '1.0rem 1.0rem',
            boxShadow: '0 0 28px rgba(0, 167, 200, .08), inset 0 0 30px rgba(0, 110, 145, .035)',
            animation: 'none'
          }}
        >
          {/* SentinelAI Logo & Branding */}
          <div className="mb-6 text-left">
            <div className="flex items-center gap-4 mb-3">
              <div className="auth-shield" aria-hidden="true"><ShieldCheck size={42} strokeWidth={1.7} /></div>
              <div>
                <h1 className="text-3xl font-bold tracking-wide" style={{ color: 'rgba(255, 255, 255, 0.98)' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.95)' }}>Sentinel</span><span style={{ color: 'rgba(0, 229, 255, 0.95)' }}>AI</span><span style={{ color: 'rgba(242, 247, 250, 0.95)' }}> OS</span>
                </h1>
                <p className="mt-1 text-[11px] uppercase tracking-[0.08em]" style={{ color: 'rgba(242, 247, 250, .84)' }}>AI-powered security operating system</p>
              </div>
            </div>
            <p
              className="mt-5 text-xl uppercase tracking-[0.25em] mb-2 font-semibold"
              style={{ color: 'rgba(0, 229, 255, 0.9)' }}
            >
              Secure SOC Access
            </p>
            <p
              className="text-base"
              style={{ color: 'rgba(200, 200, 200, 0.68)' }}
            >
              Authentication required to continue
            </p>
          </div>

          {/* Input Fields */}
          <div className="space-y-4 mb-4">
            {/* Email Input */}
            <div>
              <label
                className="block text-xs uppercase tracking-wider font-semibold mb-2"
                style={{ color: 'rgba(0, 235, 255, 0.7)' }}
              >
                Username or Email
              </label>
              <div className="relative"><UserRound size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" /><input type="email" placeholder="Enter your username or email" value={email} onChange={(e) => setEmail(e.target.value)} required className="auth-input w-full rounded-lg border text-sm transition-all duration-200" /></div>
            </div>

            {/* Password Input */}
            <div>
              <label
                className="block text-xs uppercase tracking-wider font-semibold mb-2"
                style={{ color: 'rgba(0, 235, 255, 0.7)' }}
              >
                Password
              </label>
              <div className="relative">
                <LockKeyhole size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="auth-input w-full rounded-lg border text-sm transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(0, 235, 255, 0.6)' }}
                >
                  {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="text-xs p-3.5 rounded-lg mb-5 border text-center leading-relaxed"
              style={{
                background: 'rgba(200, 50, 50, 0.14)',
                borderColor: 'rgba(255, 100, 100, 0.32)',
                color: 'rgba(255, 140, 140, 0.9)'
              }}
            >
              {error}
            </div>
          )}

          {/* Remember & Forgot */}
          <div className="flex items-center justify-between mb-6 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                style={{ accentColor: 'rgba(0, 235, 255, 0.7)' }}
              />
              <span style={{ color: 'rgba(170, 170, 170, 0.8)' }}>
                Remember this session
              </span>
            </label>
            <Link
              to="/forgot-password"
              style={{ color: 'rgba(0, 235, 255, 0.65)' }}
              className="hover:opacity-80 transition font-medium"
            >
              Forgot password?
            </Link>
          </div>

          {/* Authenticate Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 rounded-lg font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-300 mb-4 text-sm"
            style={{
              background: loading
                ? 'rgba(0, 235, 255, 0.15)'
                : 'rgba(0, 235, 255, 0.18)',
              color: 'rgba(0, 235, 255, 0.95)',
              border: '1.5px solid rgba(0, 235, 255, 0.42)',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 0 25px rgba(0, 220, 255, 0.12)',
              height: '56px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.background = 'rgba(0, 235, 255, 0.25)';
                e.target.style.boxShadow = '0 0 35px rgba(0, 220, 255, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.background = 'rgba(0, 235, 255, 0.18)';
                e.target.style.boxShadow = '0 0 25px rgba(0, 220, 255, 0.12)';
              }
            }}
          >
            <span>{loading ? 'Authenticating...' : 'Authenticate'}</span>
            {!loading && <span className="text-base">→</span>}
            {loading && (
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(0, 235, 255, 0.2)',
                  borderTop: '2px solid rgba(0, 235, 255, 0.8)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
            )}
          </button>

          {/* Divider */}
          <div
            className="h-px mb-4"
            style={{
              background: 'linear-gradient(to right, transparent, rgba(0, 235, 255, 0.15), transparent)'
            }}
          />

          {/* System Status */}
          <div
            className="text-xs font-mono uppercase tracking-wider text-center flex items-center justify-center gap-2 mb-3"
            style={{ color: 'rgba(100, 200, 100, 0.68)' }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                background: 'rgba(100, 255, 100, 0.75)',
                borderRadius: '50%',
                animation: 'pulse 2s ease-in-out infinite'
              }}
            />
            System Online
            <span style={{ color: 'rgba(120, 120, 120, 0.5)' }}>|</span>
            <span>Secure Channel Active</span>
          </div>

          {/* Encryption Notice */}
          <p
            className="text-xs text-center"
            style={{ color: 'rgba(150, 150, 150, 0.6)' }}
          >
            🔒 All connections are encrypted and monitored
          </p>

          {/* Register Link */}
          <div className="text-center mt-3 text-xs">
            <span style={{ color: 'rgba(160, 160, 160, 0.7)' }}>
              No account?{' '}
            </span>
            <Link
              to="/register"
              className="hover:opacity-80 transition font-semibold"
              style={{ color: 'rgba(0, 235, 255, 0.75)' }}
            >
              Register
            </Link>
          </div>
        </form>
      </div>

      {/* Global Styles */}
      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          100% { top: 100%; }
        }

        @keyframes binaryFlow {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }

        @keyframes binaryFlowReverse {
          0% { transform: translateY(100%); }
          100% { transform: translateY(-100%); }
        }

        @keyframes hudFloat {
          0%, 100% { opacity: 0.4; transform: translateY(0px); }
          50% { opacity: 0.7; transform: translateY(-8px); }
        }

        @keyframes cardBreathe {
          0%, 100% {
            box-shadow: 0 0 35px rgba(0, 220, 255, 0.12),
                        inset 0 0 30px rgba(0, 100, 150, 0.05);
          }
          50% {
            box-shadow: 0 0 50px rgba(0, 220, 255, 0.18),
                        inset 0 0 35px rgba(0, 100, 150, 0.08);
          }
        }

        @keyframes hackerBreathe {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.95; }
        }

        .auth-form-telemetry {
          left: 8vw;
          top: 18%;
          z-index: 2;
          width: min(500px, 82vw);
          color: rgba(0, 229, 255, .11);
          font: 11px/3.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          letter-spacing: .18em;
          white-space: pre;
          filter: blur(.15px);
          animation: auth-telemetry-drift 18s linear infinite alternate;
        }

        @keyframes auth-telemetry-drift {
          from { transform: translate3d(0, -8px, 0); opacity: .52; }
          to { transform: translate3d(10px, 18px, 0); opacity: .9; }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        input::placeholder {
          color: rgba(140, 140, 140, 0.4) !important;
        }

        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px rgba(0, 0, 0, 0.35) inset !important;
          -webkit-text-fill-color: rgba(255, 255, 255, 0.95) !important;
        }

        .auth-shield {
          display: grid;
          place-items: center;
          width: 72px;
          height: 72px;
          color: #00e5ff;
          border: 1px solid rgba(0, 229, 255, .26);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 229, 255, .16), transparent 68%);
          box-shadow: 0 0 22px rgba(0, 229, 255, .24);
        }

        .auth-scene-image {
          position: absolute;
          inset: -2%;
          z-index: 0;
          background-image: linear-gradient(90deg, rgba(2, 7, 13, .42), rgba(2, 7, 13, .02)), url('/hacker-bg.jpg');
          background-position: center center;
          background-size: cover;
          background-repeat: no-repeat;
          filter: brightness(.8) contrast(1.12) saturate(1.08);
          transform: translate3d(0, 0, 0);
          will-change: transform;
        }

        .auth-input {
          height: 58px;
          padding: 0 3.2rem 0 4rem;
          background: rgba(3, 15, 27, .60);
          border-color: rgba(0, 210, 240, .30);
          color: #f2f7fa;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, .25);
        }

        .auth-input:focus {
          outline: none;
          border-color: rgba(0, 240, 255, .75);
          background: rgba(3, 15, 27, .73);
          box-shadow: 0 0 18px rgba(0, 220, 255, .10), inset 0 2px 4px rgba(0, 0, 0, .28);
        }

        @media (max-width: 1024px) {
          .auth-form-zone { width: 420px !important; padding-left: 0 !important; }
          .auth-login-card { padding: 1.75rem 2rem !important; }
        }

        @media (max-width: 768px) {
          .auth-form-zone { width: 100% !important; padding: 1.5rem !important; justify-content: center; }
          .auth-login-card {
            width: 90vw !important;
            max-width: 380px !important;
            padding: 2.5rem 1.5rem !important;
            background: rgba(2, 12, 22, .58) !important;
          }
          .auth-form-telemetry { left: 5vw; top: 12%; font-size: 9px; line-height: 3.8; }
        }
      `}</style>
    </div>
  );
}
