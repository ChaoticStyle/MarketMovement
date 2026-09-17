import React from 'react'
import { fmtInt, fmtPct, fmtPpt, fmtDelta, sign } from '../lib/format.js'

export default function TrendTable({ table, mom, year }) {
  const { rows, totals } = table
  const y0 = year - 2, y1 = year - 1, y2 = year
  const hasMoM = !!mom
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr className="top-hd">
            <th className="grp">Dealer Group</th>
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
            return (
              <tr key={r.name} className={r.isOurs ? 'ours' : ''}>
                <td className="grp">
                  {r.name}
                  {hasMoM && m?.isNew && <span className="badge-new">NEW</span>}
                </td>
                <td>{r.isOurs && !r.has2024 ? '—' : fmtInt(r.y2024)}</td>
                <td>{fmtInt(r.y2025)}</td>
                <td>{fmtInt(r.y2026)}</td>
                <td className="col-div">{fmtPct(r.share.y2024)}</td>
                <td>{fmtPct(r.share.y2025)}</td>
                <td>{fmtPct(r.share.y2026)}</td>
                <td className={`col-div ${sign(r.move.y2425)}`}>{fmtPpt(r.move.y2425)}</td>
                <td className={sign(r.move.y2526)}>{fmtPpt(r.move.y2526)}</td>
                {hasMoM && <td className={`col-div ${sign(m?.units)}`}>{m ? fmtDelta(m.units) : '—'}</td>}
                {hasMoM && <td className={sign(m?.sharePpt)}>{m ? fmtPpt(m.sharePpt) : '—'}</td>}
              </tr>
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
