import React from 'react'
import { fmtPct, fmtPpt, fmtDelta, sign } from '../lib/format.js'
import { periodLabel } from '../lib/parse.js'

// The signature moment: an instrument cluster. Each headline reading is a
// center-baseline gauge — the needle sits at zero and swings to where Great
// American RV actually landed against the trend.
export default function Hero({ kpis, mom, segLabel, scope, period }) {
  if (!kpis) return null
  const scopeLabel = scope === 'ALL' ? 'All markets' : `${scope} market`
  const ctx = `${segLabel} · ${scopeLabel} · ${periodLabel(period)}`
  const field = segLabel === 'All' ? 'combined field' : `${segLabel.toLowerCase()} field`
  return (
    <section className="hero hero-evolve">
      <div className="hero-id">
        <div className="hero-eyebrow">Great American RV · competitive position</div>
        <div className="hero-headline">
          <em>{fmtPct(kpis.ourShare2026)}</em> share of the {field}
        </div>
        <div className="hero-ctx">{ctx}</div>
      </div>
      <div className="hero-gauges">
        <Gauge label="vs. state trend" value={kpis.vsState} display={fmtPpt(kpis.vsState)} max={0.25} />
        <Gauge label="share movement · YoY" value={kpis.ourShareMove} display={fmtPpt(kpis.ourShareMove)} max={0.05} />
        <Gauge label="month / month · units" value={mom ? mom.ourUnitsDelta : null} display={mom ? fmtDelta(mom.ourUnitsDelta) : '—'} max={120} />
      </div>
    </section>
  )
}

// A center-baseline gauge: fill runs from the midpoint out to the reading,
// clamped to ±max so small movements read as small.
function Gauge({ label, value, display, max, unit }) {
  const s = sign(value)
  const pct = value == null ? 0 : Math.max(-1, Math.min(1, value / max)) * 50
  const left = value >= 0 ? 50 : 50 + pct
  const width = Math.abs(pct)
  return (
    <div className="gauge">
      <div className="gauge-l">{label}</div>
      <div className={`gauge-v ${s}`}>{display}{unit && <span className="gauge-u">{unit}</span>}</div>
      <div className="gauge-track">
        <div className="gauge-mid" />
        <div className={`gauge-fill ${s}`} style={{ left: `${left}%`, width: `${width}%` }} />
      </div>
    </div>
  )
}
