import { memo } from 'react';

function SecurityScoreMeter({ score }) {
  const normalized = Math.max(0, Math.min(100, score));
  const color = normalized < 40 ? '#ff4d6d' : normalized < 70 ? '#ffb703' : '#00f5d4';

  return (
    <div className="glass-card p-4 flex flex-col items-center justify-center">
      <h2 className="font-display text-lg text-cyan mb-2">Security Score</h2>
      <div
        className="w-40 h-40 rounded-full grid place-items-center border-8"
        style={{ borderColor: `${color}66`, boxShadow: `0 0 24px ${color}66` }}
      >
        <div className="text-center">
          <p className="font-display text-4xl" style={{ color }}>
            {normalized}
          </p>
          <p className="text-sm text-white/70">/100</p>
        </div>
      </div>
      <p className="text-sm text-white/70 mt-3">SOC posture index (dynamic)</p>
    </div>
  );
}

export default memo(SecurityScoreMeter);
