import React, { useState } from 'react'
import { periodLabel } from '../lib/parse.js'
import { deleteSnapshot, deleteAllSnapshots } from '../lib/storage.js'

// Password-gated admin actions. The password is entered here and sent per
// request; the server (ADMIN_PASSWORD env var) is what actually enforces it.
export default function AdminPanel({ periods, onClose, onChanged }) {
  const [pw, setPw] = useState(() => { try { return sessionStorage.getItem('garv_admin_pw') || '' } catch { return '' } })
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [confirmAll, setConfirmAll] = useState(false)

  const setPassword = (v) => { setPw(v); try { sessionStorage.setItem('garv_admin_pw', v) } catch {} }

  const run = async (label, fn, msg) => {
    setErr(''); setOk(''); setBusy(label)
    try { const r = await fn(); setOk(msg); onChanged?.(r.periods) }
    catch (e) { setErr(String(e.message || e)) }
    finally { setBusy('') }
  }
  const delMonth = (p) => run(p, () => deleteSnapshot(p, pw), `Deleted ${periodLabel(p)}.`)
  const clearAll = () => run('ALL', () => deleteAllSnapshots(pw), 'All snapshots cleared.').then(() => setConfirmAll(false))

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Admin — clear data</h2>
        <p>Deleting is permanent. Enter the admin password (set as <code>ADMIN_PASSWORD</code> in Netlify) to remove a month or wipe everything.</p>

        <div className="ctl-group" style={{ marginBottom: 14 }}>
          <label className="ctl-label">Admin password</label>
          <input
            type="password" className="sel" style={{ width: '100%' }}
            value={pw} onChange={(e) => setPassword(e.target.value)}
            placeholder="password" autoComplete="off"
          />
        </div>

        <label className="ctl-label">Stored months ({periods.length})</label>
        <div className="filelist">
          {periods.length === 0 && <div className="muted" style={{ padding: '8px 2px' }}>No snapshots stored.</div>}
          {periods.slice().reverse().map((p) => (
            <div className="filerow" key={p}>
              <span style={{ flex: 1, color: 'var(--t1)' }}>{periodLabel(p)}</span>
              <button className="btn btn-danger" disabled={!pw || !!busy} onClick={() => delMonth(p)}>
                {busy === p ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>

        {err && <div className="err">{err}</div>}
        {ok && <div className="ok">{ok}</div>}

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          {!confirmAll ? (
            <button className="btn btn-danger" disabled={!pw || !periods.length || !!busy} onClick={() => { setErr(''); setOk(''); setConfirmAll(true) }}>
              Clear ALL data
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="err" style={{ margin: 0 }}>Delete all {periods.length} months?</span>
              <button className="btn btn-danger" disabled={!!busy} onClick={clearAll}>{busy === 'ALL' ? 'Clearing…' : 'Yes, clear all'}</button>
              <button className="btn" disabled={!!busy} onClick={() => setConfirmAll(false)}>Cancel</button>
            </div>
          )}
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
