import React from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine,
} from 'recharts'
import { fmtInt, fmtPct } from '../lib/format.js'

const short = (n) => (n.length > 22 ? n.slice(0, 21) + '…' : n)

// Chart palette, matched to the instrument-cluster tokens in styles.css.
const C = { ours: '#f5b544', comp: '#4d74ab', pos: '#3ecf8e', neg: '#f0616d', axis: '#6b8199', grid: '#22344a', cursor: 'rgba(245,181,68,.07)', mono: 'DM Mono, monospace' }
const tipCursor = { fill: C.cursor }
const axis = { tick: { fill: C.axis, fontSize: 10, fontFamily: C.mono }, axisLine: { stroke: C.grid }, tickLine: false }
// Many dealer groups -> vertical labels so they never overlap or truncate mid-word.
const xAxis = {
  tick: { fill: C.axis, fontSize: 9.5, fontFamily: C.mono },
  axisLine: { stroke: C.grid }, tickLine: false,
  interval: 0, angle: -90, textAnchor: 'end', tickMargin: 6, height: 118,
}

export default function Charts({ table, year }) {
  const unitData = table.rows.map((r) => ({
    name: short(r.name), full: r.name, units: r.y2026, ours: r.isOurs,
    share26: r.share.y2026, full2025: r.y2025, rooftops: (r.dealers || []).length,
  }))
  const moveData = table.rows
    .filter((r) => r.move.y2526 != null)
    .map((r) => ({
      name: short(r.name), full: r.name, ppt: +(r.move.y2526 * 100).toFixed(2), ours: r.isOurs,
      share25: r.share.y2025, share26: r.share.y2026,
    }))

  // Rich hover card for the units chart: what the bar is + the numbers behind it.
  const UnitsTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="chart-tip">
        <div className="ct-name">{d.full}{d.ours && <span className="ct-tag">OURS</span>}</div>
        <div className="ct-big">{fmtInt(d.units)}<span className="ct-unit"> units · YTD {year}</span></div>
        <div className="ct-row"><span>Share of market</span><span>{fmtPct(d.share26)}</span></div>
        <div className="ct-row"><span>Full-year {year - 1}</span><span>{fmtInt(d.full2025)}</span></div>
        {d.rooftops > 1 && <div className="ct-row"><span>Rooftops</span><span>{d.rooftops}</span></div>}
        <div className="ct-note">
          Bar height = year-to-date {year} {d.ours ? 'new units (Used excluded)' : 'new-unit registrations'}.
        </div>
      </div>
    )
  }

  // Rich hover card for the share-movement chart.
  const MoveTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const pos = d.ppt >= 0
    return (
      <div className="chart-tip">
        <div className="ct-name">{d.full}{d.ours && <span className="ct-tag">OURS</span>}</div>
        <div className={`ct-big ${pos ? 'pos' : 'neg'}`}>{pos ? '+' : ''}{d.ppt} pp<span className="ct-unit"> share move</span></div>
        <div className="ct-row"><span>Share {String(year - 1).slice(2)} → {String(year).slice(2)}</span><span>{fmtPct(d.share25)} → {fmtPct(d.share26)}</span></div>
        <div className="ct-note">
          {pos ? 'Gained' : 'Lost'} {Math.abs(d.ppt)} points of market share vs. last year.
        </div>
      </div>
    )
  }

  return (
    <div className="charts">
      <div className="chart-card">
        <div className="chart-t">{year} UNITS BY DEALER GROUP</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={unitData} margin={{ top: 4, right: 8, left: -14, bottom: 4 }}>
            <XAxis dataKey="name" {...xAxis} />
            <YAxis {...axis} />
            <Tooltip content={<UnitsTip />} cursor={tipCursor} wrapperStyle={{ outline: 'none' }} />
            <Bar dataKey="units" radius={[3, 3, 0, 0]}>
              {unitData.map((d, i) => <Cell key={i} fill={d.ours ? C.ours : C.comp} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-card">
        <div className="chart-t">SHARE MOVEMENT {String(year - 1).slice(2)}→{String(year).slice(2)} (PPT)</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={moveData} margin={{ top: 4, right: 8, left: -14, bottom: 4 }}>
            <XAxis dataKey="name" {...xAxis} />
            <YAxis {...axis} />
            <ReferenceLine y={0} stroke={C.grid} />
            <Tooltip content={<MoveTip />} cursor={tipCursor} wrapperStyle={{ outline: 'none' }} />
            <Bar dataKey="ppt" radius={[3, 3, 0, 0]}>
              {moveData.map((d, i) => <Cell key={i} fill={d.ppt >= 0 ? C.pos : C.neg} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
