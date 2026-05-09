import { storeLogo } from '../lib/logoStorage.js'

const BRANDFETCH_BASE = 'https://api.brandfetch.io/v2/brands'

interface BrandfetchLogo {
  type: string
  theme: string | null
  formats: Array<{ src: string; format: string; width?: number; height?: number }>
}

interface BrandfetchBrand {
  logos?: BrandfetchLogo[]
}

/**
 * Fetches the best available logo for a vendor domain via Brandfetch,
 * downloads it, stores it in the configured cloud/local storage, and
 * returns the public URL. Returns null on any failure so callers can
 * gracefully continue without a logo.
 */
export async function runLogoAgent(domain: string): Promise<string | null> {
  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey || apiKey === '...') return null

  try {
    const res = await fetch(`${BRANDFETCH_BASE}/${encodeURIComponent(domain)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) return null

    const brand = (await res.json()) as BrandfetchBrand
    const logoUrl = pickBestLogo(brand)
    if (!logoUrl) return null

    // Download the logo image
    const imgRes = await fetch(logoUrl)
    if (!imgRes.ok) return null

    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const ext = logoUrl.includes('.svg') ? 'svg' : 'png'

    return await storeLogo(domain, buffer, ext)
  } catch {
    return null
  }
}

function pickBestLogo(brand: BrandfetchBrand): string | null {
  if (!brand.logos?.length) return null

  // Prefer icon type, then logo; prefer light theme or null theme
  const priority = ['icon', 'logo', 'symbol', 'other']

  for (const type of priority) {
    const logo = brand.logos.find((l) => l.type === type)
    if (!logo?.formats?.length) continue

    // Prefer PNG over SVG for consistent rendering in <img>; SVG as fallback
    const png = logo.formats.find((f) => f.format === 'png')
    const svg = logo.formats.find((f) => f.format === 'svg')
    const chosen = png ?? svg
    if (chosen?.src) return chosen.src
  }

  // Absolute fallback — first available format of any logo
  return brand.logos[0]?.formats[0]?.src ?? null
}
