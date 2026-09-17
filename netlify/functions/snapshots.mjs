// Snapshot store backed by Netlify Blobs (cheap, decoupled from deploys).
//   GET    /api/snapshots            -> { periods: [...] }
//   GET    /api/snapshots/2026-07    -> <snapshot json>
//   POST   /api/snapshots  body=snap -> { ok, period }  (upserts + updates index)
//   DELETE /api/snapshots/2026-07    -> delete one month     (admin only)
//   DELETE /api/snapshots            -> delete ALL snapshots  (admin only)
// Deletes require the ADMIN_PASSWORD env var (set in Netlify) sent back in the
// x-admin-password header. The password is never shipped in the client bundle.
import { getStore } from '@netlify/blobs'
import { timingSafeEqual } from 'node:crypto'

const store = () => getStore('market-snapshots')
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } })

function checkAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return { ok: false, code: 503, msg: 'Admin password is not configured on the server (set ADMIN_PASSWORD in Netlify).' }
  const got = req.headers.get('x-admin-password') || ''
  const a = Buffer.from(got), b = Buffer.from(expected)
  const same = a.length === b.length && timingSafeEqual(a, b)
  return same ? { ok: true } : { ok: false, code: 401, msg: 'Incorrect admin password.' }
}

export default async (req) => {
  const url = new URL(req.url)
  const period = url.pathname.replace(/^\/api\/snapshots\/?/, '').replace(/^\/.netlify\/functions\/snapshots\/?/, '')

  if (req.method === 'OPTIONS') return json({ ok: true })

  try {
    const s = store()
    if (req.method === 'GET') {
      if (period) {
        const snap = await s.get(`snapshot/${period}`, { type: 'json' })
        return snap ? json(snap) : json({ error: 'not found' }, 404)
      }
      const idx = (await s.get('index', { type: 'json' })) || { periods: [] }
      return json({ periods: (idx.periods || []).slice().sort() })
    }
    if (req.method === 'POST') {
      const snap = await req.json()
      if (!snap?.period) return json({ error: 'missing period' }, 400)
      await s.setJSON(`snapshot/${snap.period}`, snap)
      const idx = (await s.get('index', { type: 'json' })) || { periods: [] }
      if (!idx.periods.includes(snap.period)) idx.periods.push(snap.period)
      idx.periods.sort()
      await s.setJSON('index', idx)
      return json({ ok: true, period: snap.period, periods: idx.periods })
    }
    if (req.method === 'DELETE') {
      const auth = checkAdmin(req)
      if (!auth.ok) return json({ error: auth.msg }, auth.code)
      const idx = (await s.get('index', { type: 'json' })) || { periods: [] }
      if (period) {
        await s.delete(`snapshot/${period}`)
        idx.periods = (idx.periods || []).filter((p) => p !== period)
        await s.setJSON('index', idx)
        return json({ ok: true, deleted: period, periods: idx.periods })
      }
      // No period -> wipe everything.
      for (const p of idx.periods || []) await s.delete(`snapshot/${p}`)
      await s.setJSON('index', { periods: [] })
      return json({ ok: true, deleted: 'all', periods: [] })
    }
    return json({ error: 'method not allowed' }, 405)
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500)
  }
}
