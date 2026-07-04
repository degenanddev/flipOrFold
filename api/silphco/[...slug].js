/** Vercel serverless proxy — SilphCo blocks browser CORS; /api/silphco/* forwards here. */
const UPSTREAM = 'https://silphcoanalytics.xyz/api/v3'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const slugParts = req.query.slug
  const slug = Array.isArray(slugParts) ? slugParts.join('/') : String(slugParts ?? '')

  const apiKey = process.env.SILPHCO_API_KEY || process.env.VITE_SILPHCO_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'Set SILPHCO_API_KEY in Vercel project env' })
    return
  }

  const url = new URL(`${UPSTREAM}/${slug}`)
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'slug' || value == null) continue
    const v = Array.isArray(value) ? value[0] : value
    if (v != null) url.searchParams.set(key, String(v))
  }

  try {
    const upstream = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
    })

    const body = await upstream.text()
    res
      .status(upstream.status)
      .setHeader('content-type', upstream.headers.get('content-type') || 'application/json')
      .setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=300')
      .end(body)
  } catch {
    res.status(502).json({ error: 'SilphCo upstream unreachable' })
  }
}
