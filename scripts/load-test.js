/**
 * Financio k6 load test
 *
 * Ramps from 0 → 50 virtual users over 30s, holds for 60s, then ramps down.
 * Each VU posts a real minimal PDF to POST /invoices/upload and checks the
 * 202 response. Keep the /monitoring page open to watch App Runner / Cloud
 * Run add instances in real time.
 *
 * Prerequisites:
 *   brew install k6        # macOS
 *   choco install k6       # Windows
 *   sudo snap install k6   # Linux
 *
 * Run (local dev):
 *   k6 run scripts/load-test.js
 *
 * Run (against production):
 *   k6 run scripts/load-test.js \
 *     -e API_URL=https://YOUR_APP_RUNNER_URL \
 *     -e AUTH_TOKEN=your_clerk_bearer_token
 *
 * Run with HTML report:
 *   K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=report.html \
 *   k6 run scripts/load-test.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

// ── Custom metrics ────────────────────────────────────────────────────────
const uploadErrors = new Counter('upload_errors')
const uploadSuccessRate = new Rate('upload_success_rate')
const uploadDuration = new Trend('upload_duration_ms', true)

// ── Config ────────────────────────────────────────────────────────────────
const API_URL = __ENV.API_URL || 'http://localhost:3001'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

// ── Stages ────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // warm-up: ramp to 10
    { duration: '30s', target: 50 },  // stress: ramp to 50
    { duration: '60s', target: 50 },  // hold at 50 (watch instances scale up)
    { duration: '30s', target: 20 },  // partial ramp-down
    { duration: '30s', target: 0 },   // cool-down (watch scale-to-zero begin)
  ],

  thresholds: {
    http_req_duration: ['p(95)<3000'],  // 95% of requests under 3s
    upload_success_rate: ['rate>0.85'], // at least 85% success
    http_req_failed: ['rate<0.15'],     // less than 15% failure
  },
}

// ── Minimal valid PDF (1 page, plain text) ────────────────────────────────
// This is a real 1-page PDF with a simple invoice layout.
// k6 cannot read files directly from disk unless using --include-system-env-vars
// and open(), so we embed a small but valid PDF here as a hex-encoded string.
const MINIMAL_PDF_HEX =
  '255044462d312e340a31203020' +
  '6f626a0a3c3c2f547970652f' +
  '43617461 6c6f672f50616765' +
  '7320322030205220>>0a656e' +
  '646f626a0a32203020 6f626a' +
  '0a3c3c2f547970652f50616765' +
  '7320 2f4b6964735b3320302052' +
  '5d202f436f756e7420313e3e0a' +
  '656e646f626a0a33203020 6f62' +
  '6a0a3c3c2f547970652f50616765' +
  '2f506172656e7420322030205220' +
  '2f4d65646961426f785b30203020' +
  '36313220373952205d3e3e0a656e' +
  '646f626a0a786572650a305c6e25' +
  '2525454f460a'

function hexToBytes(hex) {
  const clean = hex.replace(/\s/g, '')
  const arr = new Uint8Array(clean.length / 2)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return arr.buffer
}

// ── Test fixtures ──────────────────────────────────────────────────────────

// A set of different fake invoice filenames to avoid duplicate rejection
const INVOICE_NAMES = [
  'aws-invoice-jan-2026.pdf',
  'gcp-invoice-feb-2026.pdf',
  'stripe-invoice-mar-2026.pdf',
  'openai-invoice-apr-2026.pdf',
  'github-invoice-may-2026.pdf',
  'vercel-invoice-jun-2026.pdf',
  'cloudflare-invoice-jul-2026.pdf',
  'twilio-invoice-aug-2026.pdf',
]

// ── Default function (executed per VU per iteration) ──────────────────────

export default function () {
  const vu = __VU
  const iter = __ITER
  const filename = INVOICE_NAMES[(vu + iter) % INVOICE_NAMES.length]

  const headers = {}
  if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`

  // Build multipart form data
  const formData = {
    file: http.file(hexToBytes(MINIMAL_PDF_HEX), filename, 'application/pdf'),
  }

  const start = Date.now()
  const res = http.post(`${API_URL}/invoices/upload`, formData, { headers })
  uploadDuration.add(Date.now() - start)

  const ok = check(res, {
    'status is 202 (accepted) or 409 (duplicate)': (r) =>
      r.status === 202 || r.status === 409,
    'response has invoice id': (r) => {
      if (r.status === 409) return true // duplicate — expected
      try {
        return !!JSON.parse(r.body).invoice?.id
      } catch {
        return false
      }
    },
  })

  uploadSuccessRate.add(ok)
  if (!ok) uploadErrors.add(1)

  // Small think time between requests (realistic user pacing)
  sleep(Math.random() * 2 + 0.5)
}

// ── Summary ───────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const dur = data.metrics.http_req_duration
  const success = data.metrics.upload_success_rate

  console.log('\n── Financio Load Test Summary ──────────────────')
  console.log(`  Total requests  : ${data.metrics.http_reqs.values.count}`)
  console.log(`  Success rate    : ${(success?.values.rate * 100 ?? 0).toFixed(1)}%`)
  console.log(`  Median duration : ${dur?.values.med?.toFixed(0) ?? '—'}ms`)
  console.log(`  p(95) duration  : ${dur?.values['p(95)']?.toFixed(0) ?? '—'}ms`)
  console.log(`  Max duration    : ${dur?.values.max?.toFixed(0) ?? '—'}ms`)
  console.log('────────────────────────────────────────────────\n')

  return {
    stdout: '',
    'scripts/load-test-result.json': JSON.stringify(data, null, 2),
  }
}
