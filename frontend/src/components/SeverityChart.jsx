import { memo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function SeverityChart({ data }) {
  const chartData = data || [];

  return (
    <div className="glass-card p-4 h-72 transform-gpu">
      <h2 className="font-display text-lg mb-3 text-cyan">Threat Severity Analytics</h2>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#244" />
          <XAxis dataKey="severity" stroke="#8dd" />
          <YAxis stroke="#8dd" />
          <Tooltip contentStyle={{ background: '#0b1224', border: '1px solid #00f5d4', backdropFilter: 'none' }} />
          <Bar dataKey="count" fill="#00f5d4" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(SeverityChart);
