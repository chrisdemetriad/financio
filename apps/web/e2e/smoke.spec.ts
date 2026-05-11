import { expect, test } from '@playwright/test'

test('built app preview serves the SPA shell', async ({ request, baseURL }) => {
  expect(baseURL).toBeTruthy()

  const response = await request.get('/')

  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type'] ?? '').toContain('text/html')

  const html = await response.text()
  expect(html).toContain('id="root"')
})
