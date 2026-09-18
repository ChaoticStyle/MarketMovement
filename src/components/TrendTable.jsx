import React, { useState } from 'react'
import { fmtInt, fmtPct, fmtPpt, fmtDelta, sign } from '../lib/format.js'

// Short display labels for the unit-type breakdown (data keys stay full-length).
const TYPE_LABEL = { 'Class A': 'A', 'Class B': 'B', 'Class C': 'C', 'Travel Trailer': 'TT', 'Fifth Wheel': 'FW' }
const typeLabel = (l) => TYPE_LABEL[l] || l

export default function TrendTable({ table, mom, year }) {
  const { rows, totals, kpis } = table
  const y0 = year - 2, y1 = year - 1, y2 = year
  const hasMoM = !!mom
  const YEARS = [{ key: 'y2024', label: y0 }, { key: 'y2025', label: y1 }, { key: 'y2026', label: y2 }]
  const colCount = 1 + 3 + 3 + 2 + (hasMoM ? 2 : 0)

  const [open, setOpen] = useState(() => new Set())      // expanded groups -> rooftops
  const [breaks, setBreaks] = useState(() => new Set())  // open unit-type breakdowns: `${rowId}::${yKey}`
  const toggle = (name) => setOpen((p) => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n })
  const toggleBreak = (key) => setBreaks((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })

  const typeEntries = (t) => Object.entries(t || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])

  // A units cell that opens a per-type breakdown when clicked (if it has detail).
  const numCell = (rowId, yKey, value, ent, { dashed = false, extra = null, className = '' } = {}) => {
    const hasDetail = !dashed && typeEntries(ent.types?.[yKey]).length > 0
    const key = `${rowId}::${yKey}`
    const isOpen = breaks.has(key)
    return (
      <td
        className={[className, hasDetail ? 'num-click' : '', isOpen ? 'num-open' : ''].filter(Boolean).join(' ')}
        onClick={hasDetail ? () => toggleBreak(key) : undefined}
        title={hasDetail ? 'Click for unit-type breakdown' : undefined}
      >
        {dashed ? '—' : fmtInt(value)}
        {extra}
      </td>
    )
  }

  // Breakdown sub-rows for whichever years are open on this entity (group or rooftop).
  const breakRows = (rowId, ent, extraClass = '') =>
    YEARS.filter((y) => breaks.has(`${rowId}::${y.key}`)).map((y) => {
      const entries = typeEntries(ent.types?.[y.key])
      return (
        <tr key={`${rowId}::brk::${y.key}`} className={`type-break ${extraClass}`.trim()}>
          <td className="grp"><span className="tb-caption">{y.label} · by unit type</span></td>
          <td className="tb-cell" colSpan={colCount - 1}>
            <div className="tb-list">
              {entries.length
                ? entries.map(([label, n]) => (
                  <span key={label} className="tb-item"><span className="tb-t">{typeLabel(label)}</span><span className="tb-n">{fmtInt(n)}</span></span>
                ))
                : <span className="tb-empty">no unit detail</span>}
              <span className="tb-total">total {fmtInt(ent[y.key])}</span>
            </div>
          </td>
        </tr>
      )
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
            const rowId = r.name
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
                  {numCell(rowId, 'y2024', r.y2024, r, { dashed: r.isOurs && !r.has2024 })}
                  {numCell(rowId, 'y2025', r.y2025, r, {
                    extra: (r.isOurs && kpis?.ourUnitsPriorYTD > 0) ? (
                      <span
                        className="ytd-basis"
                        title={`Prior-year year-to-date (same months as ${y2}) — the YoY basis: ${fmtInt(kpis.ourUnits2026)} vs ${fmtInt(kpis.ourUnitsPriorYTD)} = ${fmtPct(kpis.ourGrowthYTD, { signed: true })}`}
                      >
                        {fmtInt(kpis.ourUnitsPriorYTD)} YTD
                      </span>
                    ) : null,
                  })}
                  {numCell(rowId, 'y2026', r.y2026, r)}
                  <td className="col-div">{fmtPct(r.share.y2024)}</td>
                  <td>{fmtPct(r.share.y2025)}</td>
                  <td>{fmtPct(r.share.y2026)}</td>
                  <td className={`col-div ${sign(r.move.y2425)}`}>{fmtPpt(r.move.y2425)}</td>
                  <td className={sign(r.move.y2526)}>{fmtPpt(r.move.y2526)}</td>
                  {hasMoM && <td className={`col-div ${sign(m?.units)}`}>{m ? fmtDelta(m.units) : '—'}</td>}
                  {hasMoM && <td className={sign(m?.sharePpt)}>{m ? fmtPpt(m.sharePpt) : '—'}</td>}
                </tr>
                {breakRows(rowId, r, r.isOurs ? 'ours' : '')}
                {canExpand && isOpen && dealers.map((d) => {
                  const dRowId = `${r.name}::${d.name}`
                  return (
                    <React.Fragment key={dRowId}>
                      <tr className={`dealer-sub ${r.isOurs ? 'ours' : ''}`}>
                        <td className="grp"><span className="dealer-name">{d.name}</span></td>
                        {numCell(dRowId, 'y2024', d.y2024, d, { dashed: d.isOurs && !r.has2024 })}
                        {numCell(dRowId, 'y2025', d.y2025, d)}
                        {numCell(dRowId, 'y2026', d.y2026, d)}
                        <td className="col-div">{fmtPct(d.share.y2024)}</td>
                        <td>{fmtPct(d.share.y2025)}</td>
                        <td>{fmtPct(d.share.y2026)}</td>
                        <td className={`col-div ${sign(d.move.y2425)}`}>{fmtPpt(d.move.y2425)}</td>
                        <td className={sign(d.move.y2526)}>{fmtPpt(d.move.y2526)}</td>
                        {hasMoM && <td className="col-div">—</td>}
                        {hasMoM && <td>—</td>}
                      </tr>
                      {breakRows(dRowId, d, `dealer ${r.isOurs ? 'ours' : ''}`)}
                    </React.Fragment>
                  )
                })}
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
