'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface LJDataPoint {
  date: string;
  l1: number;
  l2: number;
  sdDist: number;
  rule?: string;
}

interface LeveyJenningsProps {
  data: LJDataPoint[];
  mean: number;
  sd: number;
  width?: number;
  height?: number;
}

function DiamondShape(props: { cx?: number; cy?: number; fill?: string }) {
  const { cx = 0, cy = 0, fill = '#D97706' } = props;
  return (
    <svg x={cx - 6} y={cy - 6} width={12} height={12}>
      <rect x={0} y={0} width={12} height={12} transform="rotate(45 6 6)" fill={fill} />
    </svg>
  );
}

function ViolationDot(props: { cx?: number; cy?: number }) {
  const { cx = 0, cy = 0 } = props;
  return <circle cx={cx} cy={cy} r={5} fill="#BA1A1A" />;
}

export function LeveyJennings({ data, mean, sd, height = 400 }: LeveyJenningsProps) {
  const violations = data.filter((d) => d.rule);
  const normalL1 = data.filter((d) => !d.rule);
  const normalL2 = data.filter((d) => !d.rule);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#727781" />
        <YAxis tick={{ fontSize: 12 }} stroke="#727781" />
        <Tooltip
          contentStyle={{
            border: '1px solid #E5E7EB',
            borderRadius: 4,
            fontSize: 13,
          }}
          formatter={(value: number, name: string) => [
            value.toFixed(2),
            name === 'l1' ? 'Level 1' : name === 'l2' ? 'Level 2' : name,
          ]}
        />

        <ReferenceLine y={mean} stroke="#004787" strokeWidth={2} />
        <ReferenceLine y={mean + sd} stroke="#004787" strokeDasharray="6 4" strokeWidth={1} />
        <ReferenceLine y={mean - sd} stroke="#004787" strokeDasharray="6 4" strokeWidth={1} />
        <ReferenceLine y={mean + 2 * sd} stroke="#D97706" strokeDasharray="6 4" strokeWidth={1} />
        <ReferenceLine y={mean - 2 * sd} stroke="#D97706" strokeDasharray="6 4" strokeWidth={1} />
        <ReferenceLine y={mean + 3 * sd} stroke="#BA1A1A" strokeDasharray="6 4" strokeWidth={1} />
        <ReferenceLine y={mean - 3 * sd} stroke="#BA1A1A" strokeDasharray="6 4" strokeWidth={1} />

        <Scatter
          name="Level 1"
          data={normalL1}
          dataKey="l1"
          fill="#004787"
          shape={<circle r={4} />}
        />
        <Scatter
          name="Level 2"
          data={normalL2}
          dataKey="l2"
          fill="#D97706"
          shape={<DiamondShape />}
        />
        {violations.length > 0 && (
          <Scatter
            name="Violação"
            data={violations}
            dataKey="l1"
            fill="#BA1A1A"
            shape={<ViolationDot />}
          />
        )}

        <Legend
          formatter={(value: string) => (
            <span style={{ color: '#191C20', fontSize: 12 }}>{value}</span>
          )}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
