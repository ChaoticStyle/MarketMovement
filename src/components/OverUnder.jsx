import React from 'react'
import { fmtPct, fmtPpt, fmtDelta, sign } from '../lib/format.js'

// The sketch's final "over / under" summary: how Great American RV's movement
// compares to the state trend, to share of the local field, and month-to-month.
export default function OverUnder({ kpis, mom }) {
  const k = kpis
  return (
    <div className="ou-wrap">
      <div className="ou">
        <div className="ou-l">vs. State Trend (YoY units)</div>
        <div className="ou-row"><span className="k">Our YoY (YTD)</span><span className={sign(k.ourGrowthYTD)}>{fmtPct(k.ourGrowthYTD, { signed: true })}</span></div>
        <div className="ou-row"><span className="k">State YoY</span><span className={sign(k.stateGrowth)}>{fmtPct(k.stateGrowth, { signed: true })}</span></div>
        <div className={`ou-big ${sign(k.vsState)}`}>{fmtPpt(k.vsState)}</div>
        <div className="muted">{k.vsState == null ? '—' : k.vsState >= 0 ? 'outperforming the state' : 'trailing the state'}</div>
      </div>

      <div className="ou">
        <div className="ou-l">Share of the Field</div>
        <div className="ou-row"><span className="k">Our share</span><span>{fmtPct(k.ourShare2026)}</span></div>
        <div className="ou-row"><span className="k">Competition share</span><span>{fmtPct(k.compShare2026)}</span></div>
        <div className={`ou-big ${sign(k.ourShareMove)}`}>{fmtPpt(k.ourShareMove)}</div>
        <div className="muted">{k.ourShareMove == null ? '—' : k.ourShareMove >= 0 ? 'gaining share on the field' : 'losing share to the field'}</div>
      </div>

      <div className="ou">
        <div className="ou-l">Month / Month Movement</div>
        <div className="ou-row"><span className="k">Our net units</span><span className={mom ? sign(mom.ourUnitsDelta) : 'zero'}>{mom ? fmtDelta(mom.ourUnitsDelta) : '—'}</span></div>
        <div className="ou-row"><span className="k">Whole-market net</span><span className={mom ? sign(mom.marketUnitsDelta) : 'zero'}>{mom ? fmtDelta(mom.marketUnitsDelta) : '—'}</span></div>
        <div className={`ou-big ${mom ? sign(mom.ourUnitsDelta) : 'zero'}`}>{mom ? fmtDelta(mom.ourUnitsDelta) : '—'}</div>
        <div className="muted">{mom ? `vs ${mom.priorPeriod}` : 'first snapshot — no prior month yet'}</div>
      </div>
    </div>
  )
}
