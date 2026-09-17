import React from 'react'
import { fmtInt, fmtPct, fmtPpt, fmtDelta, sign } from '../lib/format.js'

export default function KpiRow({ kpis, mom, segLabel }) {
  const k = kpis
  return (
    <div className="kpis">
      <div className="kpi">
        <div className="kpi-l">Our {segLabel} Units · YTD</div>
        <div className="kpi-v gold">{fmtInt(k.ourUnits2026)}</div>
        <div className={`kpi-badge ${sign(k.ourGrowthYTD)}`}>{fmtPct(k.ourGrowthYTD, { signed: true })} vs LY YTD</div>
        <div className="kpi-sub">last year to date {fmtInt(k.ourUnitsPriorYTD)}</div>
      </div>
      <div className="kpi">
        <div className="kpi-l">Our Market Share</div>
        <div className="kpi-v gold">{fmtPct(k.ourShare2026)}</div>
        <div className={`kpi-badge ${sign(k.ourShareMove)}`}>{fmtPpt(k.ourShareMove)} vs LY</div>
        <div className="kpi-sub">share of {segLabel.toLowerCase()} market</div>
      </div>
      <div className="kpi">
        <div className="kpi-l">Competition Share</div>
        <div className="kpi-v">{fmtPct(k.compShare2026)}</div>
        <div className={`kpi-badge ${sign(k.compShareMove)}`}>{fmtPpt(k.compShareMove)} vs LY</div>
        <div className="kpi-sub">{fmtInt(k.compUnits2026)} competitor units YTD</div>
      </div>
      <div className="kpi">
        <div className="kpi-l">Us vs State Trend</div>
        <div className={`kpi-v ${sign(k.vsState)}`}>{fmtPpt(k.vsState)}</div>
        <div className="kpi-sub">our {fmtPct(k.ourGrowthYTD, { signed: true })} vs state {fmtPct(k.stateGrowth, { signed: true })}</div>
      </div>
      <div className="kpi">
        <div className="kpi-l">Month / Month · Our Units</div>
        <div className={`kpi-v ${mom ? sign(mom.ourUnitsDelta) : 'zero'}`}>{mom ? fmtDelta(mom.ourUnitsDelta) : '—'}</div>
        <div className="kpi-sub">{mom ? `net new registrations vs prior snapshot` : 'awaiting next month'}</div>
      </div>
    </div>
  )
}
