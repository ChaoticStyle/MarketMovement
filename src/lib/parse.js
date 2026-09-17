// Parsing layer — turns the monthly Excel drop into a normalized snapshot.
// Runs in the browser (File -> ArrayBuffer) and in Node (fs -> Buffer), so it
// only depends on SheetJS. No dealer/group names are hardcoded: competitor rows
// are stored raw and matched across months by group+dealer+type downstream.
import * as XLSX from 'xlsx'

// Preferred display order only — the actual store set is discovered from the
// uploaded files each month (see buildSnapshot). Codes here just sort first;
// any store found in the files but not listed is appended alphabetically.
export const STORE_ORDER = ['HMD', 'LFT', 'CLE', 'ABB', 'BAY', 'HAT', 'HUN', 'TUP', 'HEF']
// Stores that must never be included even if a file for them shows up.
export const EXCLUDE_STORES = new Set(['MEM'])

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_INDEX = Object.fromEntries(MONTHS.map((m, i) => [m.toLowerCase(), i + 1]))

// Full US name↔abbr table so the State Trend list is self-extending: any state
// (or DC) that appears in the file is picked up, and joins to the 2-letter
// state suffixes in the Market Comparison dealer names. Expanding into a new
// state needs no code change — just include it in the State Trend file.
const STATES = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO',
  Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH',
  Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
  'District of Columbia': 'DC',
}
const STATE_BY_NAME = new Map(Object.entries(STATES).map(([n, a]) => [n.toLowerCase(), { name: n, abbr: a }]))
const STATE_ABBRS = new Set(Object.values(STATES))
// Resolve a State Trend label given as either a full name or a 2-letter code.
function resolveState(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  const byName = STATE_BY_NAME.get(s.toLowerCase())
  if (byName) return byName
  const up = s.toUpperCase()
  if (up.length === 2 && STATE_ABBRS.has(up)) return { name: up, abbr: up }
  return null
}

// Market-comparison unit types -> our segment buckets.
const MOTOR_TYPES = new Set(['Class A', 'Class B', 'Class C'])
const TOW_TYPES = new Set(['Fifth Wheel', 'Travel Trailer', 'Camping Trailer', 'Truck Camper'])
export function segmentOfType(t) {
  if (MOTOR_TYPES.has(t)) return 'motors'
  if (TOW_TYPES.has(t)) return 'tow'
  return null
}

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? 0 : Number(v))
const share = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))

export function readWorkbook(data) {
  return XLSX.read(data, { type: 'array' })
}
function aoa(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true })
}

// ── Filename helpers ────────────────────────────────────────────────
// "HMD Market Comparison July 2026.xlsx" -> { store:'HMD', period:'2026-07' }
export function parseMarketFileName(name) {
  const m = name.match(/^([A-Z]{3})\s+Market\s+Comparison\s+([A-Za-z]+)\s+(\d{4})/i)
  if (!m) return null
  const mi = MONTH_INDEX[m[2].toLowerCase()]
  if (!mi) return null
  return { store: m[1].toUpperCase(), period: `${m[3]}-${String(mi).padStart(2, '0')}` }
}
export function classifyFile(name) {
  const n = name.toLowerCase()
  if (/market\s+comparison/.test(n)) return 'market'
  if (/state\s*trend/.test(n)) return 'state'
  if (/budget/.test(n)) return 'budget'
  return 'unknown'
}
export function periodLabel(period) {
  const [y, m] = period.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

// ── Market comparison (one store's local market) ────────────────────
export function parseMarketFile(wb, store) {
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = aoa(ws)
  // Header is the first row whose first cell reads "Dealer Group"; data follows
  // the sub-header row (Units / Market Share). Group & Dealer only appear on the
  // first row of each block, so we forward-fill them.
  let start = rows.findIndex((r) => r && String(r[0]).trim() === 'Dealer Group')
  start = start < 0 ? 2 : start + 2
  const out = { store, states: [], grand_total: null, rows: [] }
  let group = null
  let dealer = null
  const stateUnits = {} // abbr -> 2026 units, for state weighting
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.every((c) => c == null || c === '')) continue
    if (String(r[0]).trim() === 'Grand total') {
      out.grand_total = { y2024: num(r[3]), y2025: num(r[5]), y2026: num(r[7]) }
      continue
    }
    if (r[0] != null && r[0] !== '') group = String(r[0]).trim()
    if (r[1] != null && r[1] !== '') dealer = String(r[1]).trim()
    const type = r[2] != null ? String(r[2]).trim() : null
    if (!type) continue
    const st = dealer && dealer.match(/,\s*([A-Z]{2})\s*$/)
    const abbr = st ? st[1] : null
    const rec = {
      group, dealer, type, state: abbr,
      y2024: { units: num(r[3]), share: share(r[4]) },
      y2025: { units: num(r[5]), share: share(r[6]) },
      y2026: { units: num(r[7]), share: share(r[8]) },
    }
    out.rows.push(rec)
    if (abbr) stateUnits[abbr] = (stateUnits[abbr] || 0) + rec.y2026.units
  }
  out.states = Object.keys(stateUnits).sort((a, b) => stateUnits[b] - stateUnits[a])
  out._stateUnits = stateUnits
  return out
}

// ── Budget workbook: one store tab -> ACTUAL new units by segment ─
// Uses the "Unit Count Projection" block for the given year, summing the ACTUAL
// column beside each unit type for months [fromMonth..toMonth]. Used is excluded.
function parseUnitCountBlock(rows, year, fromMonth, toMonth) {
  // Find the header row (has 'Gas A' in col 1) whose block belongs to `year`.
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r[1] !== 'Gas A') continue
    // The year label sits just above the header row, or (for older blocks) in
    // the header row's own first cell — so scan from the header row upward.
    let blockYear = null
    for (let k = i; k >= Math.max(0, i - 4); k--) {
      const cell = rows[k] && rows[k][0]
      if (cell === year || String(cell) === String(year)) { blockYear = year; break }
    }
    if (blockYear !== year) continue
    // Map each type label to its ACTUAL column (label at c, 'ACTUAL' at c+1).
    const hdr = rows[i]
    const actualCol = {}
    for (let c = 0; c < hdr.length; c++) {
      if (hdr[c] === 'ACTUAL' && c > 0 && hdr[c - 1] != null) actualCol[String(hdr[c - 1]).trim()] = c
    }
    const sum = {}
    for (let j = i + 1; j < rows.length; j++) {
      const rr = rows[j]
      if (!rr) continue
      const label = rr[0] != null ? String(rr[0]).trim() : ''
      const mi = MONTH_INDEX[label.toLowerCase()]
      if (!mi) { if (label && !MONTHS.map((m) => m.toLowerCase()).includes(label.toLowerCase())) break; else continue }
      if (mi < fromMonth || mi > toMonth) continue
      for (const [lab, col] of Object.entries(actualCol)) sum[lab] = (sum[lab] || 0) + num(rr[col])
    }
    // Handle both column layouts: current tabs use Gas A / A Diesel / Gas C /
    // C Diesel; older (2024) tabs collapse these to Diesel and a single C.
    const g = (k) => sum[k] || 0
    return {
      ClassA: g('Gas A') + g('A Diesel') + g('Diesel'),
      ClassB: g('B'),
      ClassC: g('Gas C') + g('C Diesel') + g('C'),
      TT: g('TT'),
      FW: g('5W'),
    }
  }
  return { ClassA: 0, ClassB: 0, ClassC: 0, TT: 0, FW: 0 }
}

export function parseBudgetStoreTab(wb, store, monthIndex, year) {
  const ws = wb.Sheets[store]
  if (!ws) return null
  const rows = aoa(ws)
  // Report-year YTD (Jan..reportMonth) matches the market files' current-year YTD.
  const ytd = parseUnitCountBlock(rows, year, 1, monthIndex)
  // Prior-year YTD (Jan..reportMonth) — for a fair YTD-vs-YTD growth figure.
  const ytd_prior = parseUnitCountBlock(rows, year - 1, 1, monthIndex)
  // Full prior years match the market files' full-year 2025 / 2024 columns, so
  // year-over-year market shares stay on a consistent basis.
  const full_prior = parseUnitCountBlock(rows, year - 1, 1, 12)
  const full_prior2 = parseUnitCountBlock(rows, year - 2, 1, 12)
  return { store, ytd, ytd_prior, full_prior, full_prior2 }
}

// ── State trend ──────────────────────────────────────────────────────
export function parseStateTrend(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = aoa(ws)
  const out = []
  for (const r of rows) {
    if (!r) continue
    const st = resolveState(r[0])
    if (!st) continue // skips header/blank/total rows — only real states pass
    out.push({ state: st.name, abbr: st.abbr, units2026: num(r[1]), units2025: num(r[4]), growth: share(r[3]) })
  }
  return out
}

// ── Assemble a full monthly snapshot ─────────────────────────────────
// inputs: { period, budgetWb, marketWbs: {STORE: wb}, stateWb }
export function buildSnapshot({ period, budgetWb, marketWbs, stateWb }) {
  const [yStr, mStr] = period.split('-')
  const year = Number(yStr)
  const monthIndex = Number(mStr)
  const state_trend = stateWb ? parseStateTrend(stateWb) : []
  const growthByAbbr = Object.fromEntries(state_trend.map((s) => [s.abbr, s.growth]))

  const markets = []
  const our_stores = []
  // Discover the store set from the files: any store with a Market Comparison
  // file (keyed by the code in its filename), minus the always-excluded ones.
  // Preferred codes sort first; newly-appearing stores are appended A→Z.
  const detected = Object.keys(marketWbs).filter((s) => !EXCLUDE_STORES.has(s))
  const stores = [
    ...STORE_ORDER.filter((s) => detected.includes(s)),
    ...detected.filter((s) => !STORE_ORDER.includes(s)).sort(),
  ]
  for (const store of stores) {
    const mwb = marketWbs[store]
    let market = null
    if (mwb) {
      market = parseMarketFile(mwb, store)
      // Weighted state growth for this store's market (handles 2-state markets).
      let wg = 0, wtot = 0, dom = null, domU = -1
      for (const [abbr, u] of Object.entries(market._stateUnits)) {
        if (growthByAbbr[abbr] != null) { wg += growthByAbbr[abbr] * u; wtot += u }
        if (u > domU) { domU = u; dom = abbr }
      }
      market.state = dom
      market.state_growth = wtot > 0 ? wg / wtot : (growthByAbbr[dom] ?? null)
      delete market._stateUnits
      markets.push(market)
    }
    if (budgetWb) {
      const b = parseBudgetStoreTab(budgetWb, store, monthIndex, year)
      if (b) {
        b.state = market ? market.state : null
        b.state_growth = market ? market.state_growth : null
        our_stores.push(b)
      }
    }
  }
  return { period, generated: new Date().toISOString(), monthIndex, year, state_trend, markets, our_stores }
}
