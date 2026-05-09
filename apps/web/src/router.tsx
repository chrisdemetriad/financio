import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MonitoringPage } from '@/pages/MonitoringPage'
import { SignInPage } from '@/pages/SignInPage'

export function createRouter(darkMode: boolean, onToggleDark: () => void) {
  return createBrowserRouter([
    {
      path: '/sign-in',
      element: <SignInPage />,
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppShell darkMode={darkMode} onToggleDark={onToggleDark} />,
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
