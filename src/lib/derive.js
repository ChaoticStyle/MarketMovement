// Compute layer — pure functions. Turns a normalized snapshot into the
// sketch-style table (dealer groups vs. Great American RV), KPIs, and, when a
// prior snapshot is supplied, month-over-month movement. No I/O, no React.
import { segmentOfType } from './parse.js'

export const ANCHOR = 'Great American RV'
export const SEGMENTS = [
  { key: 'motors', label: 'Motors', sub: 'Class A / B / C' },
  { key: 'tow', label: 'Towables', sub: 'Travel Trailer, Fifth Wheel, etc.' },
  { key: 'all', label: 'All', sub: 'Motors + Towables combined' },
]

const inSeg = (type, seg) => (seg === 'all' ? segmentOfType(type) != null : segmentOfType(type) === seg)

// Our store's units for a segment, from one of a budget record's blocks:
//   'ytd'         report-year Jan..month   (matches market 2026 YTD column)
//   'ytd_prior'   prior-year Jan..month     (for fair YTD-vs-YTD growth)
//   'full_prior'  prior-year full year      (matches market 2025 column)
//   'full_prior2' prior-prior full year     (matches market 2024 column)
function ourUnits(rec, seg, which) {
  const b = rec[which]
  if (!b) return 0
  const motors = b.ClassA + b.ClassB + b.ClassC
  const tow = b.TT + b.FW
  if (seg === 'motors') return motors
  if (seg === 'tow') return tow
  return motors + tow
}

// The list of stores a scope covers. scope === 'ALL' -> every market.
export function scopeStores(snapshot, scope) {
  if (scope === 'ALL') return snapshot.markets.map((m) => m.store)
  return [scope]
}

// Units-weighted state growth across the scope's markets (2026 units weighting).
function scopeStateGrowth(snapshot, stores) {
  let wg = 0, wt = 0
  for (const m of snapshot.markets) {
    if (!stores.includes(m.store) || m.state_growth == null) continue
    const u = m.grand_total ? m.grand_total.y2026 : 0
    wg += m.state_growth * u; wt += u
  }
  return wt > 0 ? wg / wt : null
}

// Core table for a snapshot + segment + scope.
// Returns { rows, totals:{y2024,y2025,y2026}, kpis }.
export function buildTable(snapshot, seg, scope) {
  const stores = scopeStores(snapshot, scope)
  const groups = new Map() // name -> {y2024,y2025,y2026,isOurs,has2024}

  const bump = (name, isOurs, y, units, has2024 = true) => {
    if (!groups.has(name)) groups.set(name, { name, y2024: 0, y2025: 0, y2026: 0, isOurs, has2024 })
    const g = groups.get(name)
    g[y] += units
    if (!has2024) g.has2024 = false
  }

  // Competitors from each market in scope.
  for (const m of snapshot.markets) {
    if (!stores.includes(m.store)) continue
    for (const r of m.rows) {
      if (!inSeg(r.type, seg)) continue
      bump(r.group, false, 'y2024', r.y2024.units)
      bump(r.group, false, 'y2025', r.y2025.units)
      bump(r.group, false, 'y2026', r.y2026.units)
    }
  }
  // Inject our store(s) as the anchor group, on the SAME basis as the market
  // columns: full-year 2024/2025, YTD for the report year.
  let our2024 = 0, ourYtd = 0, ourYtdPrior = 0
  for (const b of snapshot.our_stores) {
    if (!stores.includes(b.store)) continue
    bump(ANCHOR, true, 'y2026', ourUnits(b, seg, 'ytd'))
    bump(ANCHOR, true, 'y2025', ourUnits(b, seg, 'full_prior'))
    bump(ANCHOR, true, 'y2024', ourUnits(b, seg, 'full_prior2'))
    our2024 += ourUnits(b, seg, 'full_prior2')
    ourYtd += ourUnits(b, seg, 'ytd')
    ourYtdPrior += ourUnits(b, seg, 'ytd_prior')
  }
  if (groups.has(ANCHOR)) groups.get(ANCHOR).has2024 = our2024 > 0

  const totals = { y2024: 0, y2025: 0, y2026: 0 }
  for (const g of groups.values()) { totals.y2024 += g.y2024; totals.y2025 += g.y2025; totals.y2026 += g.y2026 }

  const shareOf = (g, y) => {
    if (g.isOurs && y === 'y2024' && !g.has2024) return null
    const t = totals[y]
    return t > 0 ? g[y] / t : null
  }
  const rows = [...groups.values()].map((g) => {
    const s24 = shareOf(g, 'y2024'), s25 = shareOf(g, 'y2025'), s26 = shareOf(g, 'y2026')
    return {
      ...g,
      share: { y2024: s24, y2025: s25, y2026: s26 },
      move: { y2425: s24 != null && s25 != null ? s25 - s24 : null, y2526: s25 != null && s26 != null ? s26 - s25 : null },
      unitGrowth: g.y2025 > 0 ? (g.y2026 - g.y2025) / g.y2025 : null,
    }
  }).sort((a, b) => (b.y2026 - a.y2026) || (b.y2025 - a.y2025))

  // KPIs. Unit growth is only fair YTD-vs-YTD (both partial). Competitor 2025 is
  // full-year, so competition "movement" is expressed via market share, which is
  // normalized within each year and therefore comparable.
  const our = rows.find((r) => r.isOurs) || { y2025: 0, y2026: 0, share: {}, move: {} }
  const compUnits2026 = totals.y2026 - our.y2026
  const ourGrowthYTD = ourYtdPrior > 0 ? (ourYtd - ourYtdPrior) / ourYtdPrior : null
  const ourShareMove = our.move ? our.move.y2526 : null
  const stateGrowth = scopeStateGrowth(snapshot, stores)
  const kpis = {
    ourUnits2026: ourYtd, ourUnitsPriorYTD: ourYtdPrior, ourGrowthYTD,
    compUnits2026,
    ourShare2026: our.share.y2026 ?? null, ourShareMove,
    compShare2026: our.share.y2026 != null ? 1 - our.share.y2026 : null,
    compShareMove: ourShareMove != null ? -ourShareMove : null, // shares sum to 1
    stateGrowth,
    vsState: ourGrowthYTD != null && stateGrowth != null ? ourGrowthYTD - stateGrowth : null,
  }
  return { rows, totals, kpis, stores }
}

// Month-over-month: match groups by name between current and prior snapshots.
// Returns Map(name -> { units: Δ2026units, sharePpt: Δ2026share }) plus totals.
export function buildMoM(current, prior, seg, scope) {
  if (!prior) return null
  const cur = buildTable(current, seg, scope)
  const pre = buildTable(prior, seg, scope)
  const preByName = new Map(pre.rows.map((r) => [r.name, r]))
  const byName = new Map()
  for (const r of cur.rows) {
    const p = preByName.get(r.name)
    byName.set(r.name, {
      units: p ? r.y2026 - p.y2026 : null,
      sharePpt: p && r.share.y2026 != null && p.share.y2026 != null ? r.share.y2026 - p.share.y2026 : null,
      isNew: !p,
    })
  }
  const ourCur = cur.rows.find((r) => r.isOurs)
  const ourPre = pre.rows.find((r) => r.isOurs)
  return {
    byName,
    priorPeriod: prior.period,
    ourUnitsDelta: ourCur && ourPre ? ourCur.y2026 - ourPre.y2026 : null,
    marketUnitsDelta: cur.totals.y2026 - pre.totals.y2026,
  }
}

// Convenience: the previous period string given a sorted list.
export function priorPeriodOf(periods, period) {
  const i = periods.indexOf(period)
  return i > 0 ? periods[i - 1] : null
}
