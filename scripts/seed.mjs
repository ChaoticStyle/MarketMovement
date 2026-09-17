// One-time / repeatable local seed: parse the Excel files sitting in the project
// root into public/data/<period>.json (offline copy the SPA reads in dev).
// Usage: npm run seed  [-- /path/to/folder]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorkbook, buildSnapshot, parseMarketFileName, classifyFile } from '../src/lib/parse.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = process.argv[2] || path.resolve(__dirname, '..')
const dataDir = path.resolve(__dirname, '..', 'public', 'data')

const wb = (p) => readWorkbook(new Uint8Array(fs.readFileSync(p)))

const files = fs.readdirSync(root).filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
let budgetWb = null, stateWb = null, period = null
const marketWbs = {}
for (const f of files) {
  const kind = classifyFile(f)
  const full = path.join(root, f)
  if (kind === 'budget') budgetWb = wb(full)
  else if (kind === 'state') stateWb = wb(full)
  else if (kind === 'market') {
    const meta = parseMarketFileName(f)
    if (meta) { marketWbs[meta.store] = wb(full); period = period || meta.period }
  }
}

if (!period) { console.error('No "* Market Comparison <Month> <Year>.xlsx" files found in', root); process.exit(1) }
if (!budgetWb) console.warn('WARNING: no BUDGET workbook found — our_stores will be empty.')
if (!stateWb) console.warn('WARNING: no State Trend workbook found — state trend will be empty.')

const snap = buildSnapshot({ period, budgetWb, marketWbs, stateWb })

fs.mkdirSync(dataDir, { recursive: true })
fs.writeFileSync(path.join(dataDir, `${period}.json`), JSON.stringify(snap))

// Maintain a sorted period index.
const idxPath = path.join(dataDir, 'index.json')
let periods = []
try { periods = JSON.parse(fs.readFileSync(idxPath, 'utf8')).periods || [] } catch {}
if (!periods.includes(period)) periods.push(period)
periods.sort()
fs.writeFileSync(idxPath, JSON.stringify({ periods }))

// ── Console verification against known figures ──
console.log(`\nSeeded ${period}: ${snap.markets.length} markets, ${snap.our_stores.length} our-stores, ${snap.state_trend.length} states.`)
console.log('\nMarket grand totals (2024 / 2025 / 2026):')
for (const m of snap.markets) {
  const g = m.grand_total || {}
  console.log(`  ${m.store} [${m.state}] gt=${g.y2024}/${g.y2025}/${g.y2026}  rows=${m.rows.length}  stateGrowth=${(m.state_growth * 100).toFixed(1)}%`)
}
console.log('\nOur stores — YTD ACTUAL new units (Motors / Tow):')
for (const b of snap.our_stores) {
  const mo = b.ytd.ClassA + b.ytd.ClassB + b.ytd.ClassC
  const tw = b.ytd.TT + b.ytd.FW
  console.log(`  ${b.store}: A=${b.ytd.ClassA} B=${b.ytd.ClassB} C=${b.ytd.ClassC} TT=${b.ytd.TT} FW=${b.ytd.FW}  => Motors=${mo} Tow=${tw} New=${mo + tw}`)
}
