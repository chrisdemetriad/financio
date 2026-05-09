import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MonitoringPage } from '@/pages/MonitoringPage'

export function createRouter(darkMode: boolean, onToggleDark: () => void) {
  return createBrowserRouter([
    {
      element: <AppShell darkMode={darkMode} onToggleDark={onToggleDark} />,
      children: [
        { path: '/', element: <InvoicesPage /> },
        { path: '/settings', element: <SettingsPage /> },
        { path: '/monitoring', element: <MonitoringPage /> },
      ],
    },
  ])
}
