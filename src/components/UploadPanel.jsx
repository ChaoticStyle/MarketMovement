import React, { useState, useCallback } from 'react'
import { classifyFiles, buildFromFiles } from '../lib/upload.js'
import { saveSnapshot } from '../lib/storage.js'
import { periodLabel } from '../lib/parse.js'

const KIND_LABEL = { budget: 'Budget', market: 'Market', state: 'State', unknown: '?' }

// Monthly upload: drop the Budget workbook, the 9 store Market Comparison files,
// and the State Trend file. Parsed in-browser, then persisted to Netlify Blobs.
export default function UploadPanel({ onClose, onSaved }) {
  const [items, setItems] = useState([])
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const addFiles = useCallback((fileList) => {
    setErr(''); setOk('')
    setItems(classifyFiles(fileList))
  }, [])

  const onDrop = (e) => {
    e.preventDefault(); setOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  const period = items.find((i) => i.period)?.period || null
  const marketN = items.filter((i) => i.kind === 'market').length
  const hasBudget = items.some((i) => i.kind === 'budget')
  const hasState = items.some((i) => i.kind === 'state')

  const save = async () => {
    setBusy(true); setErr(''); setOk('')
    try {
      const files = items.map((i) => i.file)
      const { snap } = await buildFromFiles(files)
      await saveSnapshot(snap)
      setOk(`Saved ${periodLabel(snap.period)}.`)
      onSaved?.(snap.period)
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Upload a month</h2>
        <p>Drop the <strong>Budget workbook</strong>, all <strong>Market Comparison</strong> files, and the <strong>State Trend</strong> file. Everything is parsed in your browser; the month is stored server-side.</p>

        <label
          className={`drop ${over ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <input type="file" multiple accept=".xlsx" style={{ display: 'none' }} onChange={(e) => addFiles(e.target.files)} />
          {over ? 'Drop files…' : 'Click to choose files, or drag them here'}
        </label>

        {items.length > 0 && (
          <>
            <div className="filelist">
              {items.map((it, i) => (
                <div className="filerow" key={i}>
                  <span className={`tag ${it.kind}`}>{KIND_LABEL[it.kind]}{it.store ? ` ${it.store}` : ''}</span>
                  <span style={{ color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                </div>
              ))}
            </div>
            <div className="muted">
              Period: <strong style={{ color: 'var(--t1)' }}>{period ? periodLabel(period) : 'unknown — need a Market Comparison file'}</strong>
              {' · '}{marketN}/9 markets · budget {hasBudget ? '✓' : '—'} · state {hasState ? '✓' : '—'}
            </div>
          </>
        )}

        {err && <div className="err">{err}</div>}
        {ok && <div className="ok">{ok}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-gold" disabled={busy || !period} onClick={save}>{busy ? 'Saving…' : 'Parse & save month'}</button>
        </div>
      </div>
    </div>
  )
}
