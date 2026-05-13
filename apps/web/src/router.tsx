import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthenticateWithRedirectCallback } from '@clerk/react'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardPage } from '@/pages/DashboardPage'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MonitoringPage } from '@/pages/MonitoringPage'
import { SignInPage } from '@/pages/SignInPage'

export function createRouter() {
  return createBrowserRouter([
    // OAuth / SSO must match before the `/sign-in/*` catch-all.
    {
      path: '/sign-in/sso-callback',
      element: <AuthenticateWithRedirectCallback />,
    },
    {
      path: '/sign-in/*',
      element: <SignInPage />,
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: '/dashboard', element: <DashboardPage /> },
            { path: '/invoices', element: <InvoicesPage /> },
            { path: '/invoices/:id/details', element: <InvoicesPage /> },
            { path: '/invoices/:id/preview', element: <InvoicesPage /> },
            { path: '/vendors', element: <Navigate to="/suppliers" replace /> },
            { path: '/suppliers', element: <SuppliersPage /> },
            { path: '/settings', element: <SettingsPage /> },
            { path: '/monitoring', element: <MonitoringPage /> },
          ],
        },
      ],
    },
  ])
}
