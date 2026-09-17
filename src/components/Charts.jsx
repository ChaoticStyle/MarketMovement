import React from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine,
} from 'recharts'

const GOLD = '#f5a623', GRN = '#22c55e', RED = '#ef4444', T3 = '#5e7892'
const short = (n) => (n.length > 16 ? n.slice(0, 15) + '…' : n)

const tip = {
  contentStyle: { background: '#101820', border: '1px solid #253648', borderRadius: 7, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#dde9f5' },
  labelStyle: { color: '#a3b6cc' }, cursor: { fill: 'rgba(245,166,35,.06)' },
}
const axis = { tick: { fill: T3, fontSize: 10, fontFamily: 'DM Mono, monospace' }, axisLine: { stroke: '#253648' }, tickLine: false }

export default function Charts({ table, year }) {
  const unitData = table.rows.map((r) => ({ name: short(r.name), full: r.name, units: r.y2026, ours: r.isOurs }))
  const moveData = table.rows
    .filter((r) => r.move.y2526 != null)
    .map((r) => ({ name: short(r.name), full: r.name, ppt: +(r.move.y2526 * 100).toFixed(2), ours: r.isOurs }))

  return (
    <div className="charts">
      <div className="chart-card">
        <div className="chart-t">{year} UNITS BY DEALER GROUP</div>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={unitData} margin={{ top: 4, right: 8, left: -14, bottom: 4 }}>
            <XAxis dataKey="name" {...axis} interval={0} angle={-25} textAnchor="end" height={54} />
            <YAxis {...axis} />
            <Tooltip {...tip} formatter={(v) => [v, 'Units']} labelFormatter={(_, p) => p?.[0]?.payload?.full || ''} />
            <Bar dataKey="units" radius={[3, 3, 0, 0]}>
              {unitData.map((d, i) => <Cell key={i} fill={d.ours ? GOLD : '#3b82f6'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-card">
        <div className="chart-t">SHARE MOVEMENT {String(year - 1).slice(2)}→{String(year).slice(2)} (PPT)</div>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={moveData} margin={{ top: 4, right: 8, left: -14, bottom: 4 }}>
            <XAxis dataKey="name" {...axis} interval={0} angle={-25} textAnchor="end" height={54} />
            <YAxis {...axis} />
            <ReferenceLine y={0} stroke="#253648" />
            <Tooltip {...tip} formatter={(v) => [`${v > 0 ? '+' : ''}${v} pp`, 'Share move']} labelFormatter={(_, p) => p?.[0]?.payload?.full || ''} />
            <Bar dataKey="ppt" radius={[3, 3, 0, 0]}>
              {moveData.map((d, i) => <Cell key={i} fill={d.ppt >= 0 ? GRN : RED} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
