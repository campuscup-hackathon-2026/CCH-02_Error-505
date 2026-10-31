import { useMemo } from 'react';

const TELEMETRY = [
  '010101101', '10110010', 'THREAT DETECTED', 'SYSTEM MONITOR',
  'SECURITY PROTOCOL', 'AI ANALYSIS', 'NETWORK SCAN', 'INTRUSION DETECTED',
  'FIREWALL ACTIVE', 'THREAT INTELLIGENCE', 'PACKET ANALYSIS', 'VULNERABILITY SCAN',
  'ACCESS MONITOR', 'ENCRYPTED DATA', 'MALWARE DETECTED', 'SYSTEM ONLINE',
  'SECURITY CORE', 'ANALYZING...', 'TRACE ACTIVE', 'NETWORK TRAFFIC',
  'AUTHORIZATION', 'CYBER DEFENSE', 'SOC MONITORING', 'THREAT VECTOR',
  'ANOMALY DETECTED', 'PACKET 0x4A91', 'NODE ACTIVE', 'PORT 443', 'TCP/IP',
  'API REQUEST', 'SCAN COMPLETE', '01001010', '11010101', '00110110',
];

function telemetryValue(index) {
  if (index < TELEMETRY.length) return TELEMETRY[index];
  const hex = ((index * 7919 + 0x4a91) % 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return index % 2 === 0 ? `0x${hex}` : (index * 913).toString(2).slice(-9).padStart(9, '0');
}

function alternateValue(index) {
  const value = ((index * 4093 + 0xaf92) % 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return index % 2 === 0 ? `0x${value}` : `NODE ${value.slice(0, 2)}`;
}

/** A CSS-driven, decorative telemetry field for the application background. */
export default function AnimatedDataBackground({ density = 1 }) {
  const entries = useMemo(() => {
    const count = Math.max(12, Math.round(48 * density));
    return Array.from({ length: count }, (_, index) => ({
      id: `telemetry-${index}`,
      text: telemetryValue(index),
      alternate: alternateValue(index),
      layer: index < 20 ? 'far' : index < 39 ? 'mid' : 'near',
      motion: ['rise', 'fall', 'drift-right', 'drift-left', 'burst'][index % 5],
      left: `${(index * 37 + 11) % 108 - 4}%`,
      top: `${(index * 53 + 7) % 118 - 9}%`,
      delay: `${-(index * 1.73) % 22}s`,
      duration: `${18 + (index * 7) % 28}s`,
      size: `${10 + (index % 5) * 1.5}px`,
      opacity: `${0.035 + (index % 6) * 0.013}`,
    }));
  }, [density]);

  return (
    <div className="animated-data-background" aria-hidden="true">
      <div className="animated-data-background__grid" />
      <div className="animated-data-background__radar animated-data-background__radar--one" />
      <div className="animated-data-background__radar animated-data-background__radar--two" />
      <div className="animated-data-background__stream">
        {entries.map((entry, index) => (
          <span
            key={entry.id}
            className={`animated-data-background__item animated-data-background__item--${entry.layer} animated-data-background__item--${entry.motion} ${index % 9 === 0 ? 'animated-data-background__item--glitch' : ''}`}
            data-alternate={entry.alternate}
            style={{
              '--data-left': entry.left,
              '--data-top': entry.top,
              '--data-delay': entry.delay,
              '--data-duration': entry.duration,
              '--data-size': entry.size,
              '--data-opacity': entry.opacity,
            }}
          >
            {entry.text}
          </span>
        ))}
      </div>
    </div>
  );
}
