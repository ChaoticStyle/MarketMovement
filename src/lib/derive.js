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

// Our units for a block, split by unit type using the same labels the market
// files use, so our breakdown and competitors' line up. Only in-segment types.
function ourTypeCounts(rec, seg, which) {
  const b = rec[which]
  if (!b) return {}
  const out = {}
  if (seg !== 'tow') { if (b.ClassA) out['Class A'] = b.ClassA; if (b.ClassB) out['Class B'] = b.ClassB; if (b.ClassC) out['Class C'] = b.ClassC }
  if (seg !== 'motors') { if (b.TT) out['Travel Trailer'] = b.TT; if (b.FW) out['Fifth Wheel'] = b.FW }
  return out
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

  const emptyTypes = () => ({ y2024: {}, y2025: {}, y2026: {} })
  // Accumulate a group total and, under it, each rooftop (dealer) as a sub-row.
  const bump = (name, dealer, isOurs, y, units, has2024 = true) => {
    if (!groups.has(name)) groups.set(name, { name, y2024: 0, y2025: 0, y2026: 0, isOurs, has2024, dealers: new Map(), types: emptyTypes() })
    const g = groups.get(name)
    g[y] += units
    if (!has2024) g.has2024 = false
    if (dealer != null) {
      if (!g.dealers.has(dealer)) g.dealers.set(dealer, { name: dealer, y2024: 0, y2025: 0, y2026: 0, isOurs, types: emptyTypes() })
      const d = g.dealers.get(dealer)
      d[y] += units
    }
  }
  // Add a {typeLabel: count} map into the group's (and rooftop's) type breakdown
  // for one year — the third drill-down level behind each units number.
  const addTypes = (name, dealer, y, counts) => {
    const g = groups.get(name)
    for (const [label, n] of Object.entries(counts)) g.types[y][label] = (g.types[y][label] || 0) + n
    if (dealer != null && g.dealers.has(dealer)) {
      const d = g.dealers.get(dealer)
      for (const [label, n] of Object.entries(counts)) d.types[y][label] = (d.types[y][label] || 0) + n
    }
  }

  // Competitors from each market in scope, kept per rooftop (dealer).
  // A competitor rooftop can sit inside more than one of our stores' trade areas
  // and therefore appear in several Market Comparison files. Those files count
  // the SAME registrations (overlapping radii), so summing them double-counts in
  // a multi-market (Company) rollup. Collapse each rooftop to a single instance:
  // the market where it is largest, i.e. the fullest trade-area view. In a
  // single-store scope each rooftop occurs once, so this is a no-op there.
  const roof = new Map() // "group||dealer" -> Map(store -> {group, dealer, y2024, y2025, y2026})
  for (const m of snapshot.markets) {
    if (!stores.includes(m.store)) continue
    for (const r of m.rows) {
      if (!inSeg(r.type, seg)) continue
      const key = `${r.group}||${r.dealer ?? ''}`
      if (!roof.has(key)) roof.set(key, new Map())
      const byStore = roof.get(key)
      if (!byStore.has(m.store)) byStore.set(m.store, { group: r.group, dealer: r.dealer, y2024: 0, y2025: 0, y2026: 0, types: emptyTypes() })
      const a = byStore.get(m.store)
      a.y2024 += r.y2024.units; a.y2025 += r.y2025.units; a.y2026 += r.y2026.units
      a.types.y2024[r.type] = (a.types.y2024[r.type] || 0) + r.y2024.units
      a.types.y2025[r.type] = (a.types.y2025[r.type] || 0) + r.y2025.units
      a.types.y2026[r.type] = (a.types.y2026[r.type] || 0) + r.y2026.units
    }
  }
  for (const byStore of roof.values()) {
    const best = [...byStore.values()].sort((a, b) => (b.y2026 - a.y2026) || (b.y2025 - a.y2025) || (b.y2024 - a.y2024))[0]
    bump(best.group, best.dealer, false, 'y2024', best.y2024)
    bump(best.group, best.dealer, false, 'y2025', best.y2025)
    bump(best.group, best.dealer, false, 'y2026', best.y2026)
    addTypes(best.group, best.dealer, 'y2024', best.types.y2024)
    addTypes(best.group, best.dealer, 'y2025', best.types.y2025)
    addTypes(best.group, best.dealer, 'y2026', best.types.y2026)
  }
  // Inject our store(s) as the anchor group, on the SAME basis as the market
  // columns: full-year 2024/2025, YTD for the report year. Each store is a rooftop.
  let our2024 = 0, ourYtd = 0, ourYtdPrior = 0
  for (const b of snapshot.our_stores) {
    if (!stores.includes(b.store)) continue
    bump(ANCHOR, b.store, true, 'y2026', ourUnits(b, seg, 'ytd'))
    bump(ANCHOR, b.store, true, 'y2025', ourUnits(b, seg, 'full_prior'))
    bump(ANCHOR, b.store, true, 'y2024', ourUnits(b, seg, 'full_prior2'))
    addTypes(ANCHOR, b.store, 'y2026', ourTypeCounts(b, seg, 'ytd'))
    addTypes(ANCHOR, b.store, 'y2025', ourTypeCounts(b, seg, 'full_prior'))
    addTypes(ANCHOR, b.store, 'y2024', ourTypeCounts(b, seg, 'full_prior2'))
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
  // Per-year share for any {y2024,y2025,y2026} record against the market total.
  // Our 2024 is suppressed the same way the group is when we have no 2024 actuals.
  const shareRec = (rec, hasOur2024) => {
    const one = (y) => {
      if (rec.isOurs && y === 'y2024' && !hasOur2024) return null
      const t = totals[y]
      return t > 0 ? rec[y] / t : null
    }
    const s24 = one('y2024'), s25 = one('y2025'), s26 = one('y2026')
    return {
      share: { y2024: s24, y2025: s25, y2026: s26 },
      move: { y2425: s24 != null && s25 != null ? s25 - s24 : null, y2526: s25 != null && s26 != null ? s26 - s25 : null },
    }
  }
  const rows = [...groups.values()].map((g) => {
    const s24 = shareOf(g, 'y2024'), s25 = shareOf(g, 'y2025'), s26 = shareOf(g, 'y2026')
    const dealers = [...g.dealers.values()]
      .map((d) => ({ ...d, ...shareRec(d, g.has2024) }))
      .sort((a, b) => (b.y2026 - a.y2026) || (b.y2025 - a.y2025))
    return {
      ...g,
      dealers,
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
