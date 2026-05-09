import type { Invoice, UploadResponse, UserSettings } from '@financio/types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function request<T>(path: string, init: RequestInit = {}, getToken?: () => Promise<string | null>): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }

  if (getToken) {
    const token = await getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(body.message ?? `HTTP ${res.status}`), { status: res.status, body })
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function createApiClient(getToken: () => Promise<string | null>) {
  return {
    getInvoices: () => request<Invoice[]>('/invoices', {}, getToken),

    uploadInvoice: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return request<UploadResponse>('/invoices/upload', { method: 'POST', body: form }, getToken)
    },

    clearInvoices: () => request<void>('/invoices', { method: 'DELETE' }, getToken),

    deleteInvoice: (id: string) =>
      request<void>(`/invoices/${id}`, { method: 'DELETE' }, getToken),

    unlockInvoice: (id: string, password: string) =>
      request<Invoice>(`/invoices/${id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }, getToken),

    getSettings: () => request<UserSettings>('/settings', {}, getToken),

    patchSettings: (patch: Partial<UserSettings>) =>
      request<UserSettings>('/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }, getToken),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
