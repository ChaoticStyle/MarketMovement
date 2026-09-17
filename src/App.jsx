import React, { useEffect, useMemo, useState } from 'react'
import { listPeriods, getSnapshot } from './lib/storage.js'
import { periodLabel } from './lib/parse.js'
import { buildTable, buildMoM, priorPeriodOf, SEGMENTS, scopeStores } from './lib/derive.js'
import KpiRow from './components/KpiRow.jsx'
import TrendTable from './components/TrendTable.jsx'
import OverUnder from './components/OverUnder.jsx'
import Charts from './components/Charts.jsx'
import UploadPanel from './components/UploadPanel.jsx'
import AdminPanel from './components/AdminPanel.jsx'

export default function App() {
  const [periods, setPeriods] = useState([])
  const [period, setPeriod] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [prior, setPrior] = useState(null)
  const [seg, setSeg] = useState('all')
  const [scope, setScope] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)

  async function refresh(selectPeriod) {
    setLoading(true)
    const ps = await listPeriods()
    setPeriods(ps)
    const p = selectPeriod && ps.includes(selectPeriod) ? selectPeriod : ps[ps.length - 1] || null
    setPeriod(p)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (!period) { setSnapshot(null); setPrior(null); return }
    let live = true
    ;(async () => {
      const snap = await getSnapshot(period)
      if (!live) return
      setSnapshot(snap)
      const pp = priorPeriodOf(periods, period)
      setPrior(pp ? await getSnapshot(pp).catch(() => null) : null)
    })()
    return () => { live = false }
  }, [period, periods])

  const table = useMemo(() => (snapshot ? buildTable(snapshot, seg, scope) : null), [snapshot, seg, scope])
  const mom = useMemo(() => (snapshot && prior ? buildMoM(snapshot, prior, seg, scope) : null), [snapshot, prior, seg, scope])

  const segLabel = SEGMENTS.find((s) => s.key === seg)?.label || 'All'
  const scopeOptions = snapshot ? snapshot.markets.map((m) => m.store) : []

  return (
    <div className="app">
      <div className="top">
        <div className="wm-gem" />
        <div className="wm-name">GARV <em>Market Trends</em></div>
        <div className="wm-sep" />
        <div className="wm-sub">Competitive Movement Dashboard</div>
        <div className="top-spacer" />
        <button className="btn" onClick={() => setShowAdmin(true)}>⚙ Admin</button>
        <button className="btn btn-gold" onClick={() => setShowUpload(true)}>↑ Upload month</button>
      </div>

      <div className="controls">
        <div className="seg-tabs">
          {SEGMENTS.map((s) => (
            <button key={s.key} className={`seg-tab ${seg === s.key ? 'active' : ''}`} onClick={() => setSeg(s.key)}>
              {s.label}<span className="st-sub">{s.sub}</span>
            </button>
          ))}
        </div>
        <div className="ctl-group">
          <label className="ctl-label">Scope</label>
          <select className="sel" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="ALL">All markets · Company</option>
            {scopeOptions.map((s) => <option key={s} value={s}>{s} — local market</option>)}
          </select>
        </div>
        <div className="ctl-group">
          <label className="ctl-label">Month</label>
          <select className="sel" value={period || ''} onChange={(e) => setPeriod(e.target.value)} disabled={!periods.length}>
            {periods.length === 0 && <option>no data</option>}
            {periods.slice().reverse().map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="loading">Loading…</div>}

      {!loading && !snapshot && (
        <div className="empty">
          <div className="empty-t">No snapshots yet</div>
          <div className="muted">Click <strong>Upload month</strong> to add your first month (Budget workbook + Market Comparison files + State Trend).</div>
        </div>
      )}

      {!loading && snapshot && table && (
        <>
          <KpiRow kpis={table.kpis} mom={mom} segLabel={segLabel} />

          <div className="sec-h">
            <div className="sec-t">{segLabel.toUpperCase()} — {scope === 'ALL' ? 'ALL MARKETS' : `${scope} MARKET`}</div>
            <div className="sec-note">
              Units, share of {segLabel.toLowerCase()} market, and movement · {periodLabel(period)}
              {mom ? ` · vs ${periodLabel(mom.priorPeriod)}` : ' · first snapshot (no month-over-month yet)'}
            </div>
          </div>

          <TrendTable table={table} mom={mom} year={snapshot.year} />

          <div className="sec-h"><div className="sec-t">OVER / UNDER</div><div className="sec-note">Great American RV movement vs. the trends</div></div>
          <OverUnder kpis={table.kpis} mom={mom} />

          <Charts table={table} year={snapshot.year} />

          <div className="sec-h"><div className="sec-t">NOTES</div></div>
          <div className="muted" style={{ lineHeight: 1.7 }}>
            Our units are ACTUAL new units (Used excluded) from the Budget workbook’s Unit Count Projection, injected into each market as “Great American RV”.
            Competitor figures are new-unit registrations from the Market Comparison exports. To keep market share on a consistent basis, the {snapshot.year - 2} and {snapshot.year - 1} columns use full-year units for everyone, while {snapshot.year} is year-to-date through {periodLabel(period).split(' ')[0]} for everyone. Unit growth vs. LY is computed YTD-vs-YTD (fair); competition movement is read from market share, which is normalized within each year.
          </div>
        </>
      )}

      {showUpload && <UploadPanel onClose={() => setShowUpload(false)} onSaved={(p) => { setShowUpload(false); refresh(p) }} />}
      {showAdmin && <AdminPanel periods={periods} onClose={() => setShowAdmin(false)} onChanged={() => refresh()} />}
    </div>
  )
}
