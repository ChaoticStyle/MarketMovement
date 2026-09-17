// Client storage adapter. In production it talks to the Netlify function
// (Netlify Blobs). During `vite dev` there is no function, so it transparently
// falls back to the static JSON committed under public/data/.
const API = '/api/snapshots'
const STATIC = '/data'

async function tryJson(url, opts) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('json')) throw new Error(`${url} -> non-json`)
  return res.json()
}

export async function listPeriods() {
  try {
    const d = await tryJson(API)
    if (Array.isArray(d?.periods)) return d.periods.slice().sort()
  } catch { /* fall back */ }
  try {
    const d = await tryJson(`${STATIC}/index.json`)
    return (d.periods || []).slice().sort()
  } catch { return [] }
}

export async function getSnapshot(period) {
  try {
    return await tryJson(`${API}/${period}`)
  } catch { /* fall back */ }
  return tryJson(`${STATIC}/${period}.json`)
}

// Persist a freshly-built snapshot (from an in-browser upload). Production only.
export async function saveSnapshot(snapshot) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  })
  if (!res.ok) throw new Error(`Save failed (${res.status}). Uploads persist only on the deployed site.`)
  return res.json()
}

async function adminDelete(path, password) {
  const res = await fetch(`${API}${path}`, { method: 'DELETE', headers: { 'x-admin-password': password } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status}). Admin actions work only on the deployed site.`)
  return body
}
// Delete one month (admin password required, checked server-side).
export const deleteSnapshot = (period, password) => adminDelete(`/${period}`, password)
// Delete every month (admin password required, checked server-side).
export const deleteAllSnapshots = (password) => adminDelete('', password)
