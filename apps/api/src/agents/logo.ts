import { storeLogo } from '../lib/logoStorage.js'

const BRANDFETCH_BASE = 'https://api.brandfetch.io/v2/brands'

interface BrandfetchLogoFormat {
  src: string
  format: string
  background?: string | null
}

interface BrandfetchLogo {
  type: string
  theme: string | null
  formats: BrandfetchLogoFormat[]
}

interface BrandfetchColor {
  hex: string
  type: string
  brightness: number
}

interface BrandfetchBrand {
  logos?: BrandfetchLogo[]
  colors?: BrandfetchColor[]
}

/**
 * Fetches the best logo + brand background colour from Brandfetch.
 *  - url      → stored at logoUrl  (transparent PNG/SVG)
 *  - bgColor  → stored at logoBgColor (brand accent colour for the container)
 *
 * The logo is rendered on top of its own brand colour, so it looks
 * correct in both light and dark mode without needing two variants.
 */
export async function runLogoAgent(
  domain: string,
): Promise<{ url: string | null; bgColor: string | null }> {
  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey || apiKey === '...') return { url: null, bgColor: null }

  try {
    const res = await fetch(`${BRANDFETCH_BASE}/${encodeURIComponent(domain)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return { url: null, bgColor: null }

    const brand = (await res.json()) as BrandfetchBrand
    const picked = pickBestLogo(brand)
    const bgColor = pickContainerColor(brand, picked?.formatBackground ?? null)

    if (!picked) return { url: null, bgColor }
    const logoUrl = picked.src

    const imgRes = await fetch(logoUrl)
    if (!imgRes.ok) return { url: null, bgColor }

    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const ext = logoUrl.includes('.svg') ? 'svg' : 'png'
    const stored = await storeLogo(domain, buffer, ext)

    return { url: stored, bgColor }
  } catch {
    return { url: null, bgColor: null }
  }
}

/**
 * Pick the best logo URL + the background it was designed for.
 *
 * Scoring priority:
 *   1. Transparent/no-background logos ranked first (they work on any container)
 *   2. Type: icon > logo > symbol > other
 *   3. Format: PNG > SVG
 *
 * Returns the logo src and its intended background:
 *   - `null`          → logo is transparent; caller should use brand colour
 *   - `"white"`       → logo has a white background baked in
 *   - `"#rrggbb"`     → logo has a specific colour background baked in
 */
function pickBestLogo(brand: BrandfetchBrand): { src: string; formatBackground: string | null } | null {
  if (!brand.logos?.length) return null

  const typeOrder = ['icon', 'logo', 'symbol', 'other']
  const isTransparent = (bg: string | null | undefined) =>
    !bg || bg === 'transparent'

  const candidates = brand.logos.flatMap((l) => {
    const typeScore = typeOrder.indexOf(l.type) >= 0 ? typeOrder.indexOf(l.type) : 99
    return (l.formats ?? []).map((f) => ({
      src: f.src,
      formatBackground: f.background ?? null,
      // Transparent logos get a big bonus — they look correct on any background
      score: (isTransparent(f.background) ? 0 : 100) + typeScore * 10 + (f.format === 'png' ? 0 : 1),
    }))
  })

  candidates.sort((a, b) => a.score - b.score)
  const best = candidates[0]
  if (!best) return null
  return { src: best.src, formatBackground: isTransparent(best.formatBackground) ? null : best.formatBackground }
}

/**
 * Decide the container background colour.
 *
 * Rule:
 *   - If the logo format has a specific background (e.g. "white" for StepChange),
 *     use that — the logo was designed to sit on it.
 *   - Otherwise fall back to the brand's accent / dark / light colour.
 *   - Final fallback: null (the UI uses a neutral surface colour).
 */
function pickContainerColor(brand: BrandfetchBrand, formatBackground: string | null): string | null {
  if (formatBackground) return formatBackground

  if (!brand.colors?.length) return null
  const order = ['accent', 'dark', 'light']
  for (const type of order) {
    const c = brand.colors.find((c) => c.type === type)
    if (c?.hex) return c.hex
  }
  return brand.colors[0]?.hex ?? null
}
