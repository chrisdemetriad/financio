import { createBrowserRouter } from 'react-router-dom'
import { AuthenticateWithRedirectCallback } from '@clerk/react'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MonitoringPage } from '@/pages/MonitoringPage'
import { SignInPage } from '@/pages/SignInPage'

export function createRouter() {
  return createBrowserRouter([
    {
      path: '/sign-in',
      element: <SignInPage />,
    },
    {
      path: '/sign-in/sso-callback',
      element: <AuthenticateWithRedirectCallback />,
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppShell />,
          children: [
            { path: '/', element: <InvoicesPage /> },
            { path: '/settings', element: <SettingsPage /> },
            { path: '/monitoring', element: <MonitoringPage /> },
          ],
        },
      ],
    },
  ])
}
