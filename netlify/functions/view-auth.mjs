// GET /api/view-auth?password=...
// Page-load VIEW gate. Validates a candidate viewer password against
// VIEW_PASSWORD. Separate from ADMIN_PASSWORD (which guards deletes).
// If VIEW_PASSWORD is unset, the gate is open (frictionless until you
// set the env var in Netlify).

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } })
  }
  const expected = process.env.VIEW_PASSWORD
  const supplied = new URL(req.url).searchParams.get('password')
  const ok = !expected || supplied === expected
  return new Response(JSON.stringify({ ok }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  })
}
