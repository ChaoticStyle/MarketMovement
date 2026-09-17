// In-browser ingest: takes the month's dropped files and builds a snapshot,
// reusing the exact same parsing logic as the Node seed script.
import { readWorkbook, buildSnapshot, parseMarketFileName, classifyFile } from './parse.js'

export function classifyFiles(fileList) {
  return [...fileList]
    .filter((f) => /\.xlsx$/i.test(f.name) && !f.name.startsWith('~$'))
    .map((f) => {
      const kind = classifyFile(f.name)
      const meta = kind === 'market' ? parseMarketFileName(f.name) : null
      return { file: f, name: f.name, kind, store: meta?.store || null, period: meta?.period || null }
    })
}

export async function buildFromFiles(fileList) {
  const items = classifyFiles(fileList)
  const readOne = async (f) => readWorkbook(new Uint8Array(await f.arrayBuffer()))

  let budgetWb = null, stateWb = null, period = null
  const marketWbs = {}
  for (const it of items) {
    if (it.kind === 'budget') budgetWb = await readOne(it.file)
    else if (it.kind === 'state') stateWb = await readOne(it.file)
    else if (it.kind === 'market' && it.period) {
      marketWbs[it.store] = await readOne(it.file)
      period = period || it.period
    }
  }
  if (!period) throw new Error('No "<STORE> Market Comparison <Month> <Year>.xlsx" files found.')

  const snap = buildSnapshot({ period, budgetWb, marketWbs, stateWb })
  return { snap, items, period, hasBudget: !!budgetWb, hasState: !!stateWb, marketCount: Object.keys(marketWbs).length }
}
