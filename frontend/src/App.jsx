@import './animated-data-background.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

html {
  height: 100%;
  overflow: hidden;
}

body {
  @apply bg-bg0 text-white font-body;
  height: 100%;
  overflow: hidden;
  background-image: radial-gradient(circle at 10% 10%, rgba(0, 245, 212, 0.12), transparent 28%),
    radial-gradient(circle at 90% 20%, rgba(255, 77, 109, 0.12), transparent 34%),
    linear-gradient(180deg, #070b16 0%, #0d1732 100%);
}

#root {
  height: 100%;
  overflow: hidden;
}

body[data-security-mode='safe'] {
  background-image: radial-gradient(circle at 10% 10%, rgba(52, 211, 153, 0.14), transparent 24%),
    radial-gradient(circle at 90% 20%, rgba(0, 245, 212, 0.1), transparent 30%),
    linear-gradient(180deg, #061118 0%, #071d24 100%);
}

body[data-security-mode='defense'] {
  background-image: radial-gradient(circle at 10% 10%, rgba(255, 183, 3, 0.14), transparent 24%),
    radial-gradient(circle at 90% 20%, rgba(0, 245, 212, 0.1), transparent 30%),
    linear-gradient(180deg, #09101f 0%, #14151f 100%);
}

body[data-security-mode='lockdown'] {
  background-image: radial-gradient(circle at 10% 10%, rgba(251, 113, 133, 0.24), transparent 24%),
    radial-gradient(circle at 90% 20%, rgba(239, 68, 68, 0.18), transparent 30%),
    linear-gradient(180deg, #160609 0%, #26070d 100%);
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 38px 38px;
  opacity: 0.15;
}

.cyber-noise-overlay {
  background-image: radial-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 0), radial-gradient(rgba(0, 245, 212, 0.025) 1px, transparent 0);
  background-size: 3px 3px, 5px 5px;
  opacity: 0.18;
  mix-blend-mode: screen;
  animation: noise-drift 7s linear infinite;
}

.floating-particles {
  background-image:
    radial-gradient(circle at 14% 22%, rgba(0, 245, 212, 0.18) 0 1px, transparent 2px),
    radial-gradient(circle at 78% 12%, rgba(59, 130, 246, 0.16) 0 1px, transparent 2px),
    radial-gradient(circle at 86% 68%, rgba(255, 77, 109, 0.18) 0 1px, transparent 2px),
    radial-gradient(circle at 38% 76%, rgba(52, 211, 153, 0.16) 0 1px, transparent 2px);
  opacity: 0.5;
  animation: particle-drift 22s ease-in-out infinite alternate;
}

.radar-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #00f5d4;
  box-shadow: 0 0 0 0 rgba(0, 245, 212, 0.65);
  animation: radar-dot-pulse 1.8s infinite;
}

.threat-signal {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid rgba(0, 245, 212, 0.28);
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(0, 245, 212, 0.12), rgba(124, 246, 255, 0.03));
  color: rgba(221, 255, 252, 0.92);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  box-shadow: inset 0 0 16px rgba(0, 245, 212, 0.05), 0 0 18px rgba(0, 245, 212, 0.08);
}

.threat-signal strong {
  color: #00f5d4;
  font-weight: 700;
}

.threat-signal__core {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: #00f5d4;
  box-shadow: 0 0 0 0 rgba(0, 245, 212, 0.55);
  animation: threat-signal-pulse 1.7s ease-out infinite;
}

body[data-security-mode='lockdown']::before {
  opacity: 0.34;
  animation: lockdown-flash 1.1s infinite;
}

.glass-card {
  @apply backdrop-blur-lg bg-card border border-cyan/30 rounded-xl shadow-neon;
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: transform;
  content-visibility: auto;
  contain-intrinsic-size: 320px;
  contain: layout paint style;
}

.terminal-box {
  @apply bg-black/50 border border-lime/30 rounded-lg p-3 font-mono text-sm;
  transform: translateZ(0);
  backface-visibility: hidden;
  contain: layout paint style;
}

.content-surface {
  content-visibility: auto;
  contain-intrinsic-size: 360px;
  contain: layout paint style;
}

body[data-security-mode='lockdown'] .glass-card {
  @apply border-rose-500/40 shadow-lg;
  box-shadow: 0 0 20px rgba(251, 113, 133, 0.24), inset 0 0 22px rgba(251, 113, 133, 0.08);
}

body[data-security-mode='lockdown'] .terminal-box {
  @apply border-rose-500/30;
  background: rgba(24, 3, 8, 0.82);
  box-shadow: 0 0 18px rgba(251, 113, 133, 0.25);
}

body[data-security-mode='lockdown'] .cyber-scan-overlay {
  background: repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0 2px, transparent 2px 6px);
  animation: scanline 3.2s linear infinite;
  mix-blend-mode: screen;
  opacity: 0.32;
}

.cyber-scan-overlay {
  background: linear-gradient(180deg, rgba(0, 245, 212, 0.04), transparent 18%, rgba(0, 245, 212, 0.04) 82%, transparent);
  animation: scanline 4.8s linear infinite;
}

.matrix-background {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  transform: translateZ(0);
}

.matrix-column {
  position: absolute;
  top: -20%;
  color: rgba(52, 211, 153, 0.2);
  font-family: monospace;
  text-shadow: 0 0 8px rgba(52, 211, 153, 0.35);
  animation: matrix-fall linear infinite;
  white-space: pre;
}

.matrix-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(0, 245, 212, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 245, 212, 0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  animation: grid-drift 18s linear infinite;
  opacity: 0.6;
}

.radar-pulse {
  position: absolute;
  inset: 20% auto auto 50%;
  width: 280px;
  height: 280px;
  border-radius: 999px;
  border: 1px solid rgba(0, 245, 212, 0.16);
  transform: translateX(-50%);
  box-shadow: 0 0 0 1px rgba(0, 245, 212, 0.08), 0 0 60px rgba(0, 245, 212, 0.08);
  animation: radar-pulse 5.8s ease-in-out infinite;
}

@media (max-width: 1024px) {
  .glass-card {
    backdrop-filter: blur(12px);
  }

  .matrix-column,
  .radar-pulse {
    opacity: 0.25;
  }
}

@media (max-width: 640px) {
  body::before {
    background-size: 28px 28px;
    opacity: 0.08;
  }

  .matrix-background,
  .floating-particles,
  .cyber-noise-overlay {
    display: none;
  }

  .glass-card {
    backdrop-filter: blur(8px);
    box-shadow: 0 0 12px rgba(0, 245, 212, 0.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@keyframes matrix-fall {
  0% { transform: translateY(-20%) translateX(0); opacity: 0; }
  12% { opacity: 0.45; }
  100% { transform: translateY(120vh) translateX(0); opacity: 0; }
}

@keyframes scanline {
  0% { transform: translateY(-4%); }
  100% { transform: translateY(4%); }
}

@keyframes grid-drift {
  0% { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(44px, 44px, 0); }
}

@keyframes radar-pulse {
  0%, 100% { transform: translateX(-50%) scale(0.9); opacity: 0.45; }
  50% { transform: translateX(-50%) scale(1.07); opacity: 0.95; }
}

@keyframes lockdown-flash {
  0%, 100% { filter: saturate(1); }
  50% { filter: saturate(1.6) brightness(1.2); }
}

@keyframes noise-drift {
  0% { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(12px, -18px, 0); }
}

@keyframes particle-drift {
  0% { transform: translate3d(0, 0, 0) scale(1); }
  100% { transform: translate3d(-16px, 18px, 0) scale(1.05); }
}

@keyframes radar-dot-pulse {
  0% { box-shadow: 0 0 0 0 rgba(0, 245, 212, 0.55); }
  70% { box-shadow: 0 0 0 14px rgba(0, 245, 212, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 245, 212, 0); }
}

@keyframes threat-signal-pulse {
  0% { box-shadow: 0 0 0 0 rgba(0, 245, 212, 0.58); }
  70% { box-shadow: 0 0 0 10px rgba(0, 245, 212, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 245, 212, 0); }
}
