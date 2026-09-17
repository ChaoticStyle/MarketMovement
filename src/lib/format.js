export const fmtInt = (n) => (n == null || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US'))

export function fmtPct(x, { dp = 1, signed = false } = {}) {
  if (x == null || Number.isNaN(x)) return '—'
  const v = (x * 100).toFixed(dp)
  return signed && x > 0 ? `+${v}%` : `${v}%`
}

// percentage-point delta (share movement)
export function fmtPpt(x, { dp = 1 } = {}) {
  if (x == null || Number.isNaN(x)) return '—'
  const v = (x * 100).toFixed(dp)
  return `${x > 0 ? '+' : ''}${v} pp`
}

export const fmtDelta = (n) => (n == null || Number.isNaN(n) ? '—' : `${n > 0 ? '+' : ''}${Math.round(n).toLocaleString('en-US')}`)

export const sign = (x) => (x == null || Number.isNaN(x) || x === 0 ? 'zero' : x > 0 ? 'pos' : 'neg')
