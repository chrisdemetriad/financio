import { RouterProvider } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SettingsSyncer } from '@/lib/settings'
import { createRouter } from './router'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string
const router = createRouter()

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <SettingsSyncer />
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#1c1e26',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#e2e8f0',
            },
          }}
        />
      </TooltipProvider>
    </ClerkProvider>
  )
}
