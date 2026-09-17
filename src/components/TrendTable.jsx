import React, { useState } from 'react'
import { fmtInt, fmtPct, fmtPpt, fmtDelta, sign } from '../lib/format.js'

export default function TrendTable({ table, mom, year }) {
  const { rows, totals, kpis } = table
  const y0 = year - 2, y1 = year - 1, y2 = year
  const hasMoM = !!mom
  const [open, setOpen] = useState(() => new Set())
  const toggle = (name) => setOpen((prev) => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr className="top-hd">
            <th className="grp">Dealer Group / Rooftop</th>
            <th colSpan={3}>Units</th>
            <th className="col-div" colSpan={3}>Market Share</th>
            <th className="col-div" colSpan={2}>Share Movement</th>
            {hasMoM && <th className="col-div" colSpan={2}>Month&nbsp;/&nbsp;Month</th>}
          </tr>
          <tr>
            <th className="grp"></th>
            <th>{y0}</th><th>{y1}</th><th>{y2}</th>
            <th className="col-div">{y0}</th><th>{y1}</th><th>{y2}</th>
            <th className="col-div">{`${String(y0).slice(2)}→${String(y1).slice(2)}`}</th>
            <th>{`${String(y1).slice(2)}→${String(y2).slice(2)}`}</th>
            {hasMoM && <th className="col-div">Units</th>}
            {hasMoM && <th>Share</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = hasMoM ? mom.byName.get(r.name) : null
            const dealers = r.dealers || []
            const canExpand = dealers.length > 1
            const isOpen = open.has(r.name)
            return (
              <React.Fragment key={r.name}>
                <tr className={r.isOurs ? 'ours' : ''}>
                  <td className="grp">
                    {canExpand ? (
                      <button className="grp-toggle" onClick={() => toggle(r.name)} aria-expanded={isOpen}>
                        <span className="caret">{isOpen ? '▾' : '▸'}</span>
                        {r.name}
                        <span className="grp-count">{dealers.length}</span>
                      </button>
                    ) : (
                      <span
                        className={`grp-static ${dealers.length === 1 ? 'has-tip' : ''}`}
                        title={dealers.length === 1 ? dealers[0].name : undefined}
                      >
                        {r.name}
                      </span>
                    )}
                    {hasMoM && m?.isNew && <span className="badge-new">NEW</span>}
                  </td>
                  <td>{r.isOurs && !r.has2024 ? '—' : fmtInt(r.y2024)}</td>
                  <td>
                    {fmtInt(r.y2025)}
                    {r.isOurs && kpis?.ourUnitsPriorYTD > 0 && (
                      <span
                        className="ytd-basis"
                        title={`Prior-year year-to-date (same months as ${y2}) — the YoY basis: ${fmtInt(kpis.ourUnits2026)} vs ${fmtInt(kpis.ourUnitsPriorYTD)} = ${fmtPct(kpis.ourGrowthYTD, { signed: true })}`}
                      >
                        {fmtInt(kpis.ourUnitsPriorYTD)} YTD
                      </span>
                    )}
                  </td>
                  <td>{fmtInt(r.y2026)}</td>
                  <td className="col-div">{fmtPct(r.share.y2024)}</td>
                  <td>{fmtPct(r.share.y2025)}</td>
                  <td>{fmtPct(r.share.y2026)}</td>
                  <td className={`col-div ${sign(r.move.y2425)}`}>{fmtPpt(r.move.y2425)}</td>
                  <td className={sign(r.move.y2526)}>{fmtPpt(r.move.y2526)}</td>
                  {hasMoM && <td className={`col-div ${sign(m?.units)}`}>{m ? fmtDelta(m.units) : '—'}</td>}
                  {hasMoM && <td className={sign(m?.sharePpt)}>{m ? fmtPpt(m.sharePpt) : '—'}</td>}
                </tr>
                {canExpand && isOpen && dealers.map((d) => (
                  <tr key={`${r.name}::${d.name}`} className={`dealer-sub ${r.isOurs ? 'ours' : ''}`}>
                    <td className="grp"><span className="dealer-name">{d.name}</span></td>
                    <td>{d.isOurs && !r.has2024 ? '—' : fmtInt(d.y2024)}</td>
                    <td>{fmtInt(d.y2025)}</td>
                    <td>{fmtInt(d.y2026)}</td>
                    <td className="col-div">{fmtPct(d.share.y2024)}</td>
                    <td>{fmtPct(d.share.y2025)}</td>
                    <td>{fmtPct(d.share.y2026)}</td>
                    <td className={`col-div ${sign(d.move.y2425)}`}>{fmtPpt(d.move.y2425)}</td>
                    <td className={sign(d.move.y2526)}>{fmtPpt(d.move.y2526)}</td>
                    {hasMoM && <td className="col-div">—</td>}
                    {hasMoM && <td>—</td>}
                  </tr>
                ))}
              </React.Fragment>
            )
          })}
          <tr className="total">
            <td className="grp">Total — market</td>
            <td>{fmtInt(totals.y2024)}</td><td>{fmtInt(totals.y2025)}</td><td>{fmtInt(totals.y2026)}</td>
            <td className="col-div">100%</td><td>100%</td><td>100%</td>
            <td className="col-div">—</td><td>—</td>
            {hasMoM && <td className="col-div">{fmtDelta(mom.marketUnitsDelta)}</td>}
            {hasMoM && <td>—</td>}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
